<?php

namespace App\Notifications\Portal;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Carbon;

/**
 * L'invitation au portail : un lien d'activation valable 72 h.
 *
 * En local, MAIL_MAILER=log l'écrit dans le journal ; la fiche client
 * permet aussi de copier le lien pour l'envoyer par un autre canal.
 */
class PortalInvitation extends Notification
{
    use Queueable;

    public function __construct(
        public readonly string $url,
        public readonly Carbon $expiresAt,
        public readonly string $clientName,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Votre accès à l\'espace professionnel')
            ->greeting('Bonjour '.$notifiable->name.',')
            ->line("Un accès à l'espace professionnel a été ouvert pour {$this->clientName}.")
            ->line('Vous pourrez y consulter nos références et leurs prix, passer commande et suivre votre compte.')
            ->action('Choisir mon mot de passe', $this->url)
            ->line('Ce lien est valable jusqu\'au '.$this->expiresAt->timezone(config('app.business_timezone'))->format('d/m/Y à H:i').'.');
    }
}
