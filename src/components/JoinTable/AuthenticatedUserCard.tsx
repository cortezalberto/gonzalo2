/**
 * AuthenticatedUserCard - Shows the logged-in user info
 */

import { useTranslation } from 'react-i18next'
import type { AuthUser } from '../../types'
import { getSafeImageUrl } from '../../utils/validation'

interface AuthenticatedUserCardProps {
  user: AuthUser
  onSignOut: () => void
}

export default function AuthenticatedUserCard({ user, onSignOut }: AuthenticatedUserCardProps) {
  const { t } = useTranslation()

  // Validate user picture URL to prevent XSS
  const safeAvatarUrl = getSafeImageUrl(user.picture, 'avatar')
  const hasValidPicture = user.picture && safeAvatarUrl !== '/default-avatar.svg'

  return (
    <div className="bg-dark-card border border-dark-border rounded-xl p-4">
      <div className="flex items-center gap-3">
        {hasValidPicture ? (
          <img
            src={safeAvatarUrl}
            alt={user.full_name}
            className="w-10 h-10 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary font-semibold">
              {user.full_name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white font-medium truncate">{user.full_name}</p>
          <p className="text-dark-muted text-xs truncate">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="text-dark-muted hover:text-white text-xs underline"
        >
          {t('joinTable.signOut')}
        </button>
      </div>
    </div>
  )
}
