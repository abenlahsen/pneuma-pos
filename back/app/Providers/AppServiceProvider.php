<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register()
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot()
    {
        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(5)->by(
                strtolower((string) $request->input('email')).'|'.$request->ip()
            );
        });

        // Portail client (étape 13.1) : 5 tentatives de connexion par 15 min,
        // par email et adresse IP.
        RateLimiter::for('portal-login', function (Request $request) {
            return Limit::perMinutes(15, 5)->by(
                'portal|'.strtolower((string) $request->input('email')).'|'.$request->ip()
            );
        });

        // Activation, mot de passe oublié, réinitialisation : par adresse IP.
        RateLimiter::for('portal-public', function (Request $request) {
            return Limit::perMinutes(15, 10)->by('portal-public|'.$request->ip());
        });

        RateLimiter::for('portal', function (Request $request) {
            return Limit::perMinute((int) config('app.api_rate_limit', 60))->by(
                'portal|'.(optional($request->user('portal'))->id ?: $request->ip())
            );
        });

        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute((int) config('app.api_rate_limit', 60))->by(
                optional($request->user())->id ?: $request->ip()
            );
        });
    }
}
