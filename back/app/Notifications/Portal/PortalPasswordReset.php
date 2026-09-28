<?php

namespace App\Notifications\Portal;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;

/** La réinitialisation du mot de passe portail : même principe que l'invitation. */
class PortalPasswordReset extends Notification
{
    use Queueable;

    public function __construct(
        public readonly string $url,
        public readonly Carbon $expiresAt,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Réinitialiser votre mot de passe')
            ->greeting('Bonjour '.$notifiable->name.',')
            ->line('Une réinitialisation du mot de passe de votre espace professionnel a été demandée.')
            ->action('Choisir un nouveau mot de passe', $this->url)
            ->line('Ce lien est valable jusqu\'au '.$this->expiresAt->timezone(config('app.business_timezone'))->format('d/m/Y à H:i').'.')
            ->line('Si vous n\'êtes pas à l\'origine de cette demande, ignorez ce message : rien ne change.');
    }
}
