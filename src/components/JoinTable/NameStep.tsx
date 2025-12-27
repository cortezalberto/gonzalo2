/**
 * NameStep - Second step of the join table flow
 * Handles diner name input, Google sign-in, and table joining
 */

import { useTranslation } from 'react-i18next'
import type { AuthUser } from '../../types'
import { VALIDATION_CONFIG } from '../../utils/validation'
import { isGoogleAuthConfigured } from '../../services/googleAuth'
import GoogleSignInButton from '../GoogleSignInButton'
import AuthenticatedUserCard from './AuthenticatedUserCard'

interface NameStepProps {
  tableNumber: string
  dinerName: string
  nameError: string | null
  isPending: boolean
  isAuthenticated: boolean
  user: AuthUser | null
  formAction: (payload: FormData) => void
  onNameChange: (value: string) => void
  onSignOut: () => void
  onGoogleAuthSuccess: () => void
}

export default function NameStep({
  tableNumber,
  dinerName,
  nameError,
  isPending,
  isAuthenticated,
  user,
  formAction,
  onNameChange,
  onSignOut,
  onGoogleAuthSuccess,
}: NameStepProps) {
  const { t } = useTranslation()

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="action" value="join_table" />
      <input type="hidden" name="tableNumber" value={tableNumber} />

      {/* Table number display */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/20 rounded-full mb-4">
          <span className="text-2xl font-bold text-primary">{tableNumber}</span>
        </div>
        <p className="text-dark-muted text-sm">{t('joinTable.table')} {tableNumber}</p>
      </div>

      {/* Google Sign-In Section */}
      {isGoogleAuthConfigured() && !isAuthenticated && (
        <GoogleAuthSection onSuccess={onGoogleAuthSuccess} />
      )}

      {/* Authenticated user card */}
      {isAuthenticated && user && (
        <AuthenticatedUserCard user={user} onSignOut={onSignOut} />
      )}

      {/* Name input */}
      <div>
        <label className="block text-white text-sm font-medium mb-2">
          {t('joinTable.whatsYourName')}
        </label>
        <input
          type="text"
          name="dinerName"
          value={dinerName}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t('joinTable.namePlaceholder')}
          maxLength={VALIDATION_CONFIG.dinerName.maxLength}
          disabled={isPending}
          className={`w-full bg-dark-card border rounded-xl px-4 py-3 text-white placeholder-dark-muted focus:outline-none transition-colors ${
            nameError ? 'border-red-500 focus:border-red-500' : 'border-dark-border focus:border-primary'
          }`}
          autoFocus={!isAuthenticated}
          aria-invalid={!!nameError}
          aria-describedby={nameError ? 'name-error' : undefined}
        />
        {nameError && (
          <p id="name-error" className="text-red-500 text-xs mt-1" role="alert">
            {t(nameError, { max: VALIDATION_CONFIG.dinerName.maxLength })}
          </p>
        )}
        <p className="text-dark-muted text-xs mt-2">
          {isAuthenticated
            ? t('joinTable.nameHelpAuth')
            : t('joinTable.nameHelpGuest')}
        </p>
      </div>

      {/* Action buttons */}
      <div className="space-y-3">
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-primary hover:bg-primary/90 disabled:bg-dark-elevated disabled:text-dark-muted text-white font-semibold py-3 px-4 rounded-xl transition-colors"
        >
          {isPending ? t('joinTable.joining') : t('joinTable.joinTable')}
        </button>

        <button
          type="submit"
          name="action"
          value="change_table"
          disabled={isPending}
          className="w-full bg-transparent border border-dark-border hover:border-dark-muted text-dark-muted hover:text-white py-3 px-4 rounded-xl transition-colors disabled:opacity-50"
        >
          {t('joinTable.changeTable')}
        </button>
      </div>
    </form>
  )
}

/**
 * GoogleAuthSection - Dividers and Google sign-in button
 */
function GoogleAuthSection({ onSuccess }: { onSuccess: () => void }) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <Divider text={t('common.optional')} />

      <GoogleSignInButton
        text="continue_with"
        theme="filled_black"
        size="large"
        width={320}
        className="flex justify-center"
        onSuccess={onSuccess}
      />

      <p className="text-dark-muted text-xs text-center">
        {t('joinTable.signInToSaveHistory')}
      </p>

      <Divider text={t('joinTable.continueAsGuest')} />
    </div>
  )
}

/**
 * Divider - Horizontal line with centered text
 */
function Divider({ text }: { text: string }) {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-dark-border"></div>
      </div>
      <div className="relative flex justify-center text-xs">
        <span className="bg-dark-bg px-2 text-dark-muted">{text}</span>
      </div>
    </div>
  )
}
