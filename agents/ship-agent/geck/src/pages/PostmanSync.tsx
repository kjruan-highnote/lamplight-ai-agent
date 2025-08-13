import React from 'react';
import { useTheme } from '../themes/ThemeContext';
import { Card, CardContent } from '../components/ui/Card';

export const PostmanSync: React.FC = () => {
  const { theme } = useTheme();

  return (
    <div>
      <h1 style={{ 
        color: theme.colors.primary, 
        fontSize: theme.typography.fontSize['3xl'], 
        fontWeight: theme.typography.fontWeight.bold,
        marginBottom: theme.spacing.xl
      }}>
        Postman Sync
      </h1>
      <Card variant="default" padding="lg">
        <CardContent>
          <p style={{ color: theme.colors.textMuted }}>Postman sync coming soon...</p>
        </CardContent>
      </Card>
    </div>
  );
};