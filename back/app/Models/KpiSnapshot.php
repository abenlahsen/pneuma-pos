<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class KpiSnapshot extends Model
{
    const UPDATED_AT = null;

    protected $fillable = ['snapshot_date', 'data'];

    protected $casts = [
        'snapshot_date' => 'date',
        'data'          => 'array',
    ];
}
