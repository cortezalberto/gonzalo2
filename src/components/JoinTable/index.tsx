/**
 * JoinTable - Entry point for table joining flow
 *
 * Refactored from 400-line component into:
 * - index.tsx: Main component with state management (~120 lines)
 * - TableNumberStep.tsx: First step UI
 * - NameStep.tsx: Second step UI with Google auth
 * - AuthenticatedUserCard.tsx: User info display
 * - SharedCartInfo.tsx: Info card component
 */

import { useState, useActionState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useTableStore } from '../../stores/tableStore'
import { useAuthState, useAuthActions } from '../../stores/authStore'
import { validateTableNumber, validateDinerName } from '../../utils/validation'
import { joinTableLogger } from '../../utils/logger'
import LanguageSelector from '../LanguageSelector'
import TableNumberStep from './TableNumberStep'
import NameStep from './NameStep'
import SharedCartInfo from './SharedCartInfo'

interface JoinTableProps {
  defaultTableNumber?: string
}

interface FormState {
  step: 'table' | 'name'
  tableNumber: string
  dinerName: string
  tableError: string | null
  nameError: string | null
}

export default function JoinTable({ defaultTableNumber = '' }: JoinTableProps) {
  const { t } = useTranslation()
  const joinTable = useTableStore((state) => state.joinTable)
  const { user, isAuthenticated } = useAuthState()
  const { signOut } = useAuthActions()

  const initialState: FormState = {
    step: defaultTableNumber ? 'name' : 'table',
    tableNumber: defaultTableNumber,
    dinerName: isAuthenticated && user?.full_name ? user.full_name : '',
    tableError: null,
    nameError: null,
  }

  const [formState, formAction, isPending] = useActionState(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const actionValue = formData.get('action')
      const action = typeof actionValue === 'string' ? actionValue : ''
      const tableNumberValue = formData.get('tableNumber')
      const tableNumber = typeof tableNumberValue === 'string' ? tableNumberValue : prevState.tableNumber
      const dinerNameValue = formData.get('dinerName')
      const dinerName = typeof dinerNameValue === 'string' ? dinerNameValue : ''

      if (action === 'submit_table') {
        const validation = validateTableNumber(tableNumber)
        if (!validation.isValid) {
          return { ...prevState, tableNumber, tableError: validation.error }
        }
        return { ...prevState, step: 'name', tableNumber: tableNumber.trim(), tableError: null }
      }

      if (action === 'join_table') {
        const validation = validateDinerName(dinerName)
        if (!validation.isValid) {
          return { ...prevState, dinerName, nameError: validation.error }
        }
        joinTable(
          prevState.tableNumber.trim(),
          `Mesa ${prevState.tableNumber}`,
          dinerName.trim() || undefined,
          undefined
        )
        return { ...prevState, dinerName: dinerName.trim(), nameError: null }
      }

      if (action === 'change_table') {
        return { ...prevState, step: 'table', tableError: null, nameError: null }
      }

      return prevState
    },
    initialState
  )

  // Controlled input state - use key to reset NameStep when auth changes
  const authKey = isAuthenticated ? `auth-${user?.id}` : 'guest'
  const [tableNumber, setTableNumber] = useState(() => formState.tableNumber)
  const [dinerName, setDinerName] = useState(() => {
    // Initial value: use authenticated user's name or form state
    if (isAuthenticated && user?.full_name) return user.full_name
    return formState.dinerName
  })

  // Google auth success handler - uses reactive state from useAuthState hook
  const handleGoogleAuthSuccess = useCallback(() => {
    try {
      if (!isAuthenticated || !user) {
        joinTableLogger.warn('Auth state not ready after success callback')
        return
      }

      if (!user.full_name || !formState.tableNumber) return

      // Update diner name with authenticated user's name
      setDinerName(user.full_name)

      const authContext = {
        userId: user.id,
        fullName: user.full_name,
        email: user.email,
        picture: user.picture,
      }

      joinTable(
        formState.tableNumber.trim(),
        `Mesa ${formState.tableNumber}`,
        user.full_name,
        authContext
      )
    } catch (error) {
      joinTableLogger.error('Failed to join table after Google auth', error)
    }
  }, [formState.tableNumber, joinTable, isAuthenticated, user])

  // Derived table number for display - use formState as source of truth when on table step
  const displayTableNumber = formState.step === 'name' ? formState.tableNumber : tableNumber

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center px-4 sm:px-6">
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            {t('app.title')}<span className="text-primary">/</span>
          </h1>
          <p className="text-dark-muted mt-2 text-sm sm:text-base">
            {t('app.subtitle')}
          </p>
        </div>

        {formState.step === 'table' ? (
          <TableNumberStep
            tableNumber={displayTableNumber}
            tableError={formState.tableError}
            isPending={isPending}
            formAction={formAction}
            onTableChange={setTableNumber}
          />
        ) : (
          <NameStep
            key={authKey}
            tableNumber={formState.tableNumber}
            dinerName={dinerName}
            nameError={formState.nameError}
            isPending={isPending}
            isAuthenticated={isAuthenticated}
            user={user}
            formAction={formAction}
            onNameChange={setDinerName}
            onSignOut={signOut}
            onGoogleAuthSuccess={handleGoogleAuthSuccess}
          />
        )}

        <SharedCartInfo />
      </div>
    </div>
  )
}
