import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../themes/ThemeContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login, error, quickLogin, isDevMode } = useAuth();
  const { theme } = useTheme();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsLoading(true);

    try {
      await login(formData.email, formData.password);
      navigate('/');
    } catch (err: any) {
      setFormError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const containerStyles: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    fontFamily: theme.typography.fontFamily.base,
  };

  const formStyles: React.CSSProperties = {
    width: '100%',
    maxWidth: '400px',
    padding: theme.spacing.lg,
  };

  const headerStyles: React.CSSProperties = {
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  };

  const titleStyles: React.CSSProperties = {
    fontSize: theme.typography.fontSize['3xl'],
    fontFamily: theme.typography.fontFamily.display,
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
    textShadow: theme.effects.customEffects?.textGlow || 'none',
  };

  const subtitleStyles: React.CSSProperties = {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontFamily.mono,
  };

  const inputGroupStyles: React.CSSProperties = {
    marginBottom: theme.spacing.md,
  };

  const labelStyles: React.CSSProperties = {
    display: 'block',
    marginBottom: theme.spacing.xs,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    fontFamily: theme.typography.fontFamily.mono,
  };

  const errorStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: `${theme.colors.danger}20`,
    border: `1px solid ${theme.colors.danger}`,
    borderRadius: theme.borders.radius.md,
    color: theme.colors.danger,
    fontSize: theme.typography.fontSize.sm,
    marginBottom: theme.spacing.md,
  };

  return (
    <div style={containerStyles}>
      {theme.id === 'vault-tec' && (
        <div className="absolute inset-0 bg-scanlines opacity-10"></div>
      )}
      
      <div style={formStyles}>
        <Card>
          <div style={headerStyles}>
            <h1 style={titleStyles}>G.E.C.K.</h1>
            <p style={subtitleStyles}>CONFIGURATION SYSTEM v2.77</p>
          </div>

          <form onSubmit={handleSubmit}>
            {(formError || error) && (
              <div style={errorStyles}>
                <AlertCircle size={16} />
                <span>{formError || error}</span>
              </div>
            )}

            <div style={inputGroupStyles}>
              <label htmlFor="email" style={labelStyles}>
                EMAIL ADDRESS
              </label>
              <div style={{ position: 'relative' }}>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="user@example.com"
                  required
                  disabled={isLoading}
                  style={{ paddingLeft: '2.5rem' }}
                />
                <User 
                  size={18} 
                  style={{
                    position: 'absolute',
                    left: theme.spacing.sm,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: theme.colors.textMuted,
                  }}
                />
              </div>
            </div>

            <div style={inputGroupStyles}>
              <label htmlFor="password" style={labelStyles}>
                PASSWORD
              </label>
              <div style={{ position: 'relative' }}>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                  style={{ paddingLeft: '2.5rem' }}
                />
                <Lock 
                  size={18} 
                  style={{
                    position: 'absolute',
                    left: theme.spacing.sm,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: theme.colors.textMuted,
                  }}
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={isLoading}
              disabled={isLoading}
              style={{ width: '100%', marginTop: theme.spacing.lg }}
            >
              {isLoading ? 'AUTHENTICATING...' : 'ACCESS TERMINAL'}
            </Button>
          </form>

          {/* Development Quick Login */}
          {isDevMode && (
            <div style={{
              marginTop: theme.spacing.xl,
              paddingTop: theme.spacing.lg,
              borderTop: `1px solid ${theme.colors.border}`,
            }}>
              <div style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.warning || theme.colors.textMuted,
                fontFamily: theme.typography.fontFamily.mono,
                textAlign: 'center',
                marginBottom: theme.spacing.md,
              }}>
                ⚠️ DEVELOPMENT MODE - QUICK LOGIN
              </div>
              <div style={{ display: 'flex', gap: theme.spacing.sm }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    quickLogin?.('technical_implementation_engineer');
                    navigate('/');
                  }}
                  style={{ flex: 1 }}
                >
                  Engineer
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    quickLogin?.('solutions_engineer');
                    navigate('/');
                  }}
                  style={{ flex: 1 }}
                >
                  Solutions
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    quickLogin?.('admin');
                    navigate('/');
                  }}
                  style={{ flex: 1 }}
                >
                  Admin
                </Button>
              </div>
              <div style={{
                marginTop: theme.spacing.sm,
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.textMuted,
                textAlign: 'center',
              }}>
                Or use any email/password combination
              </div>
            </div>
          )}

          <div style={{ 
            marginTop: theme.spacing.xl,
            paddingTop: theme.spacing.lg,
            borderTop: `1px solid ${theme.colors.border}`,
            textAlign: 'center',
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.textMuted,
            fontFamily: theme.typography.fontFamily.mono,
          }}>
            <div>AVAILABLE ROLES:</div>
            <div style={{ marginTop: theme.spacing.xs }}>
              • Technical Implementation Engineer<br />
              • Solutions Engineer<br />
              • System Administrator
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};