<?php

namespace App\Http\Controllers;

use App\Domain\Users\UserService;
use App\Http\Resources\Users\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserController extends Controller
{
    /**
     * @var UserService
     */
    private $userService;

    /**
     * @param UserService $userService
     */
    public function __construct(UserService $userService)
    {
        $this->userService = $userService;
    }
    
    public function index(Request $request): JsonResponse
    {
        $query = User::with('roles');

        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->boolean('all')) {
            return response()->json(UserResource::collection($query->get())->resolve($request));
        }

        $paginated = $query->paginate($request->get('per_page', 20));

        return response()->json([
            'current_page' => $paginated->currentPage(),
            'data' => UserResource::collection($paginated->items())->resolve($request),
            'first_page_url' => $paginated->url(1),
            'from' => $paginated->firstItem(),
            'last_page' => $paginated->lastPage(),
            'last_page_url' => $paginated->url($paginated->lastPage()),
            'links' => $paginated->linkCollection()->toArray(),
            'next_page_url' => $paginated->nextPageUrl(),
            'path' => $paginated->path(),
            'per_page' => $paginated->perPage(),
            'prev_page_url' => $paginated->previousPageUrl(),
            'to' => $paginated->lastItem(),
            'total' => $paginated->total(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8|confirmed',
            'phone' => 'nullable|string|max:255',
            'commission_rate' => 'nullable|numeric|min:0|max:100',
            'prime_per_tyre' => 'nullable|numeric|min:0',
            'role' => 'nullable|string|exists:roles,name',
        ]);

        $user = $this->userService->create($request);

        if ($user instanceof JsonResponse) {
            return $user;
        }

        return response()->json((new UserResource($user))->resolve($request), 201);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json((new UserResource($user->load('roles')))->resolve(request()));
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email,' . $user->id,
            'password' => 'nullable|string|min:8|confirmed',
            'phone' => 'nullable|string|max:255',
            'commission_rate' => 'nullable|numeric|min:0|max:100',
            'prime_per_tyre' => 'nullable|numeric|min:0',
            'role' => 'nullable|string|exists:roles,name',
        ]);

        $updatedUser = $this->userService->update($request, $user);

        if ($updatedUser instanceof JsonResponse) {
            return $updatedUser;
        }

        return response()->json((new UserResource($updatedUser))->resolve($request));
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        $response = $this->userService->delete($request, $user);

        if ($response instanceof JsonResponse) {
            return $response;
        }

        return response()->json(null, 204);
    }
}