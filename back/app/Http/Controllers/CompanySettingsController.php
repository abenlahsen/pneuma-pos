<?php

namespace App\Http\Controllers;

use App\Domain\Settings\CompanySettingsService;
use App\Http\Requests\Settings\UpdateCompanySettingsRequest;
use App\Http\Resources\Settings\CompanySettingsResource;
use Illuminate\Http\JsonResponse;

class CompanySettingsController extends Controller
{
    /**
     * @var CompanySettingsService
     */
    private $companySettingsService;

    public function __construct(CompanySettingsService $companySettingsService)
    {
        $this->companySettingsService = $companySettingsService;
    }

    public function show(): JsonResponse
    {
        $settings = $this->companySettingsService->get();

        return response()->json((new CompanySettingsResource($settings))->resolve(request()));
    }

    public function update(UpdateCompanySettingsRequest $request): JsonResponse
    {
        $settings = $this->companySettingsService->update($request->validated());

        return response()->json((new CompanySettingsResource($settings))->resolve($request));
    }
}