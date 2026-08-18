import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/context/AuthContext'
import { Button, Card } from '@/components/ui'

export function SignUpPage() {
  const { t } = useTranslation()
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signUp({ fullName, email, password })
      navigate('/onboarding/learner')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10">
      <Card className="w-full max-w-md">
        <h1 className="text-2xl font-extrabold text-slate-900">{t('auth.signUp')}</h1>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <Field label={t('auth.fullName')}>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input"
              autoComplete="name"
            />
          </Field>
          <Field label={t('auth.email')}>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
              autoComplete="email"
            />
          </Field>
          <Field label={t('auth.password')}>
            <input
              required
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              autoComplete="new-password"
            />
          </Field>
          {error && <p className="text-sm font-medium text-danger-600">{error}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? t('common.loading') : t('auth.signUpCta')}
          </Button>
          <p className="text-xs text-slate-500">{t('auth.popiaNote')}</p>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          {t('auth.haveAccount')}{' '}
          <Link to="/sign-in" className="font-semibold text-brand-600">
            {t('auth.signInLink')}
          </Link>
        </p>
      </Card>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  )
}
