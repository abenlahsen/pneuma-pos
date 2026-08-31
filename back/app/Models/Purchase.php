<?php

namespace App\Models;

use App\Models\Concerns\AggregatesPaymentMethods;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Purchase extends Model
{
    use AggregatesPaymentMethods, HasFactory;

    /**
     * `payment_methods` is derived at read time from the recorded payments —
     * see AggregatesPaymentMethods. Purchases have no API Resource class
     * (PurchaseController returns raw models), so $appends is how it reaches
     * the JSON payload.
     */
    protected $appends = ['payment_methods'];

    protected $fillable = [
        'date',
        'with_invoice',
        'bl_number',
        'invoice_number',
        'total_quantity',
        'total_price',
        'discount',
        'net_amount',
        'returned_quantity',
        'returned_amount',
        'supplier_id',
        'commercial_id',
        'status',
        'payment_status',
        'payment_date',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'date' => 'date',
        'payment_date' => 'date',
        'with_invoice' => 'boolean',
        'total_quantity' => 'integer',
        'total_price' => 'decimal:2',
        'discount' => 'decimal:2',
        'net_amount' => 'decimal:2',
        'returned_quantity' => 'integer',
        'returned_amount' => 'decimal:2',
    ];

    // Removed appended total_price because it is now a real DB column.

    public function items()
    {
        return $this->hasMany(PurchaseItem::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function commercial()
    {
        return $this->belongsTo(User::class, 'commercial_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Legacy relation — only returns payments created against this purchase alone
     * (purchase_id set directly). Multi-purchase supplier payments do not set
     * purchase_id; use `allocations()` for the authoritative paid-amount source.
     */
    public function payments()
    {
        return $this->hasMany(PurchasePayment::class);
    }

    public function allocations()
    {
        return $this->hasMany(PurchasePaymentAllocation::class);
    }

    public function paidAmount(): float
    {
        return (float) $this->allocations()->sum('amount');
    }

    public function returns()
    {
        return $this->hasMany(PurchaseReturn::class);
    }

    /**
     * Total cash actually refunded by the supplier across every return —
     * distinct from returned_amount, which is the value of goods sent back
     * regardless of whether that return was refunded in cash.
     */
    public function refundedAmount(): float
    {
        return (float) $this->returns()->sum('refund_amount');
    }

    /**
     * Fraction of total_price that survives the purchase-level discount into
     * net_amount — e.g. net_amount = total_price * discountFactor().
     */
    private function discountFactor(): float
    {
        return max(0, 1 - ((float) $this->discount / 100));
    }

    /**
     * `returned_amount` is stored gross (sum of quantity * unit_price on the
     * returned lines, same convention as total_price/PurchaseItem — no
     * per-line discount), so it must be scaled by the same discount % as
     * total_price -> net_amount before it can be subtracted from net_amount.
     */
    public function returnedNetAmount(): float
    {
        return round((float) $this->returned_amount * $this->discountFactor(), 2);
    }

    /**
     * What this purchase effectively costs once returned goods are excluded —
     * the figure PurchaseService::refreshPaymentStatus(), PurchaseService::
     * summary() and the supplier balance calculations must compare paid
     * amounts against, instead of the raw net_amount.
     */
    public function effectiveNetAmount(): float
    {
        return max(0, round((float) $this->net_amount - $this->returnedNetAmount(), 2));
    }

    /**
     * Cash still with the supplier: what was actually paid minus what it has
     * already refunded on returns.
     */
    public function netPaidAmount(): float
    {
        return round($this->paidAmount() - $this->refundedAmount(), 2);
    }
}
