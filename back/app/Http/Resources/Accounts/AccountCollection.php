<?php

namespace App\Http\Resources\Accounts;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\ResourceCollection;

class AccountCollection extends ResourceCollection
{
    /**
     * Transform the resource collection into an array.
     *
     * @return array<int, mixed>
     */
    public function toArray(Request $request): array
    {
        return $this->collection->map(function ($account) use ($request) {
            return $account instanceof AccountResource
                ? $account->resolve($request)
                : (new AccountResource($account))->resolve($request);
        })->all();
    }
}
