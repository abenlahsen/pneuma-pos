<?php

namespace App\Http\Controllers;

use App\Support\BusinessDate;
use Illuminate\Http\JsonResponse;

/**
 * GET /api/business-date — la date du jour au Maroc, selon le serveur.
 *
 * Le front s'en sert pour proposer et borner une date « du jour » (la
 * réception d'un achat) sans dépendre des règles de fuseau du navigateur.
 */
class BusinessDateController extends Controller
{
    public function __invoke(): JsonResponse
    {
        return response()->json([
            'date' => BusinessDate::today(),
            'timezone' => BusinessDate::timezone(),
        ]);
    }
}
