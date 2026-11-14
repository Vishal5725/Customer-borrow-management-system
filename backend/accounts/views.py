from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User
from .serializers import (
    CustomTokenObtainPairSerializer,
    UserSerializer,
    CreateCustomerSerializer,
    BulkCustomerCreateSerializer,
)
from .permissions import IsAdminUser


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            token = RefreshToken(request.data['refresh'])
            token.blacklist()
            return Response({'detail': 'Successfully logged out.'}, status=status.HTTP_200_OK)
        except Exception:
            return Response({'detail': 'Invalid token.'}, status=status.HTTP_400_BAD_REQUEST)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class CustomerListCreateView(generics.ListCreateAPIView):
    serializer_class = CreateCustomerSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        return User.objects.filter(role=User.ROLE_CUSTOMER).order_by('-date_joined')


class CustomerDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CreateCustomerSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]

    def get_queryset(self):
        return User.objects.filter(role=User.ROLE_CUSTOMER)


# ── Bulk customer create ───────────────────────────────────────────────────────

class CustomerBulkCreateView(APIView):
    """
    POST /auth/customers/bulk/
    Body: { "customers": [{first_name, last_name, username, phone_number, password}, …] }
    Returns: { created: N, customers: [...] }
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def post(self, request):
        serializer = BulkCustomerCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        created = serializer.save()
        return Response({
            'created': len(created),
            'customers': CreateCustomerSerializer(created, many=True).data,
        }, status=status.HTTP_201_CREATED)


# ── Bulk delete endpoints ──────────────────────────────────────────────────────

class CustomerBulkDeleteView(APIView):
    """
    DELETE /auth/customers/bulk/
    Body: { "ids": [1, 2, 3] }
    Deletes the given customer accounts (and cascades their borrow entries/payments).
    """
    permission_classes = [IsAuthenticated, IsAdminUser]

    def delete(self, request):
        ids = request.data.get('ids', [])
        if not ids or not isinstance(ids, list):
            return Response({'detail': 'Provide a list of ids.'}, status=status.HTTP_400_BAD_REQUEST)
        qs = User.objects.filter(id__in=ids, role=User.ROLE_CUSTOMER)
        count = qs.count()
        qs.delete()
        return Response({'deleted': count}, status=status.HTTP_200_OK)