<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Personnel;
use App\Models\Supplier;

class Purchase extends Model
{
    use HasFactory;

    protected $fillable = [
        'date',
        'product',
        'supplier_id',
        'commercial_id',
        'quantity',
        'unit_price',
        'status',
        'payment_status',
        'payment_method',
        'payment_date',
    ];

    protected $casts = [
        'date' => 'date',
        'payment_date' => 'date',
        'unit_price' => 'decimal:2',
    ];

    protected $appends = ['total_price'];

    public function getTotalPriceAttribute(): float
    {
        return round($this->quantity * $this->unit_price, 2);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function commercial()
    {
        return $this->belongsTo(Personnel::class, 'commercial_id');
    }

    public function payments()
    {
        return $this->hasMany(PurchasePayment::class);
    }
}
