from rest_framework.permissions import BasePermission


class IsAdminUser(BasePermission):
    """Allow access only to admin/owner users."""
    message = 'Access restricted to shop admin only.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_admin)


class IsCustomerUser(BasePermission):
    """Allow access only to customer users."""
    message = 'Access restricted to customers only.'

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_customer)


class IsAdminOrOwner(BasePermission):
    """Admin has full access; customer can only access their own data."""
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.user.is_admin:
            return True
        # For customer: obj must have a 'customer' field pointing to request.user
        customer = getattr(obj, 'customer', None)
        return customer == request.user
