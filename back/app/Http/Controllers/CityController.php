<?php

namespace App\Http\Controllers;

use App\Models\City;
use Illuminate\Http\JsonResponse;

class CityController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(
            City::orderBy('name')->pluck('name')
        );
    }
}
