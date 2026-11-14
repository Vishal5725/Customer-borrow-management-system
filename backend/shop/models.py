import math
from django.db import models
from django.conf import settings
from django.utils import timezone


class Item(models.Model):
    name = models.CharField(max_length=200)
    rate = models.DecimalField(max_digits=10, decimal_places=2)
    quantity = models.PositiveIntegerField(default=0)
    image_url = models.URLField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} (₹{self.rate})"


class BorrowEntry(models.Model):
    """A single borrow transaction. Status is only pending or paid — no partial."""
    STATUS_PENDING = 'pending'
    STATUS_PAID = 'paid'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_PAID, 'Paid'),
    ]

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='borrow_entries',
        limit_choices_to={'role': 'customer'},
    )
    # Keep 'partial' only so existing DB rows aren't broken; new code never sets it
    status = models.CharField(max_length=10, choices=STATUS_CHOICES + [('partial', 'Partially Paid')],
                              default=STATUS_PENDING)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Borrow #{self.id} – {self.customer.get_full_name()} [{self.status}]"

    @property
    def total_amount(self):
        """Sum of ceiled item subtotals → always an integer."""
        return sum(item.subtotal for item in self.items.all())

    @property
    def total_paid(self):
        """Sum of ceiled verified payment amounts → always an integer."""
        return sum(
            math.ceil(float(p.amount))
            for p in self.payments.filter(is_verified=True)
        )

    @property
    def balance_due(self):
        """Per-entry due. Can be negative if overpaid — clamp at customer level."""
        return self.total_amount - self.total_paid


class BorrowItem(models.Model):
    borrow_entry = models.ForeignKey(BorrowEntry, on_delete=models.CASCADE, related_name='items')
    item = models.ForeignKey(Item, on_delete=models.PROTECT, related_name='borrow_items')
    quantity = models.PositiveIntegerField(default=1)
    rate_at_borrow = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        unique_together = ('borrow_entry', 'item')

    def __str__(self):
        return f"{self.quantity}x {self.item.name}"

    @property
    def subtotal(self):
        """Always an integer — ceiled at item level."""
        return math.ceil(float(self.quantity * self.rate_at_borrow))

    def save(self, *args, **kwargs):
        if not self.rate_at_borrow:
            self.rate_at_borrow = self.item.rate
        super().save(*args, **kwargs)


class Payment(models.Model):
    METHOD_CASH = 'cash'
    METHOD_ONLINE = 'online'
    METHOD_CHOICES = [
        (METHOD_CASH, 'Cash'),
        (METHOD_ONLINE, 'Online (UPI/GPay)'),
    ]

    borrow_entry = models.ForeignKey(BorrowEntry, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=10, choices=METHOD_CHOICES, default=METHOD_ONLINE)
    is_verified = models.BooleanField(default=False)
    paid_at = models.DateTimeField(default=timezone.now)
    verified_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='verified_payments',
    )
    screenshot_note = models.TextField(blank=True)

    class Meta:
        ordering = ['-paid_at']

    def __str__(self):
        status = '✓' if self.is_verified else '⏳'
        return f"{status} ₹{self.amount} via {self.method} – Entry #{self.borrow_entry_id}"

    def verify(self, admin_user, paid_at=None):
        self.is_verified = True
        self.verified_by = admin_user
        self.verified_at = timezone.now()
        if paid_at:
            self.paid_at = paid_at
        self.save()
        # Update entry status: only pending or paid — no partial
        entry = self.borrow_entry
        entry.status = BorrowEntry.STATUS_PAID if entry.balance_due <= 0 else BorrowEntry.STATUS_PENDING
        entry.save()


class ShopSettings(models.Model):
    whatsapp_number = models.CharField(max_length=20)
    upi_qr_image = models.ImageField(upload_to="shop/QR", null=True)
    shop_name = models.CharField(max_length=100, default='My Shop')

    class Meta:
        verbose_name = 'Shop Settings'
        verbose_name_plural = 'Shop Settings'

    def __str__(self):
        return self.shop_name

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


# ── Customer-level financial summary (all calculations here, not in frontend) ──

def get_customer_financials(customer):
    """
    Returns a dict with all amounts as plain integers (ceiled).
    advance > 0 means customer has overpaid across all entries.
    total_due > 0 means customer still owes money.
    advance and total_due are mutually exclusive (one is always 0).
    """
    entries = BorrowEntry.objects.filter(customer=customer).prefetch_related(
        'items__item', 'payments'
    )
    total_borrowed = sum(e.total_amount for e in entries)          # sum of ceiled ints
    total_paid_sum = sum(e.total_paid for e in entries)            # sum of ceiled ints
    advance = max(0, total_paid_sum - total_borrowed)
    total_due = max(0, total_borrowed - total_paid_sum)
    return {
        'total_payable': total_borrowed,
        'total_paid': total_paid_sum,
        'advance': advance,
        'total_due': total_due,
        'entries_count': entries.count(),
    }