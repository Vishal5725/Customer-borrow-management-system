from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Add extra claims to JWT token."""
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['full_name'] = user.get_full_name()
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['role'] = self.user.role
        data['user_id'] = self.user.id
        data['username'] = self.user.username
        data['full_name'] = self.user.get_full_name()
        return data


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'phone_number', 'role']
        read_only_fields = ['id', 'role']


class CreateCustomerSerializer(serializers.ModelSerializer):
    """Used by admin to create a customer account."""
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'phone_number', 'password']

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.role = User.ROLE_CUSTOMER
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance

class BulkCustomerRowSerializer(serializers.Serializer):
    """Single row in a bulk customer import."""
    first_name   = serializers.CharField(max_length=150, required=False, allow_blank=True, default='')
    last_name    = serializers.CharField(max_length=150, required=False, allow_blank=True, default='')
    username     = serializers.CharField(max_length=150)
    phone_number = serializers.CharField(max_length=15, required=False, allow_blank=True, default='')
    password     = serializers.CharField(min_length=6, write_only=True)
 
    def validate_username(self, value):
        return value.strip().lower().replace(' ', '_')
 
 
class BulkCustomerCreateSerializer(serializers.Serializer):
    customers = BulkCustomerRowSerializer(many=True, min_length=1)
 
    def validate_customers(self, value):
        if len(value) > 200:
            raise serializers.ValidationError("Maximum 200 customers per bulk import.")
        usernames = [r['username'] for r in value]
        dupes = {u for u in usernames if usernames.count(u) > 1}
        if dupes:
            raise serializers.ValidationError(f"Duplicate usernames: {', '.join(dupes)}")
        existing = User.objects.filter(username__in=usernames).values_list('username', flat=True)
        if existing:
            raise serializers.ValidationError(
                f"Usernames already taken: {', '.join(existing)}"
            )
        return value
 
    def create(self, validated_data):
        rows = validated_data['customers']
        created = []
        for row in rows:
            password = row.pop('password')
            user = User(role=User.ROLE_CUSTOMER, **row)
            user.set_password(password)
            user.save()
            created.append(user)
        return created
 