<?php

namespace App\Http\Controllers;

use App\Domain\Reporting\MonthlyReportService;
use App\Http\Requests\Reporting\MonthlyReportRequest;
use Illuminate\Http\JsonResponse;

class ReportingController extends Controller
{
    public function __construct(protected MonthlyReportService $reportService) {}

    public function monthly(MonthlyReportRequest $request): JsonResponse
    {
        return response()->json($this->reportService->build($request->year(), $request->month()));
    }
}
