import React, { useState } from 'react';
import { useTheme } from '../../themes/ThemeContext';
import { Card, CardHeader, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Palette, Download, Trash2, Plus, Eye, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const ThemeSettings: React.FC = () => {
  const { theme, themes, setTheme, customThemes, addCustomTheme, removeCustomTheme, importTheme, exportTheme } = useTheme();
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const handleThemeChange = (themeId: string) => {
    setTheme(themeId);
  };

  const handleExport = (themeId: string) => {
    try {
      const json = exportTheme(themeId);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${themeId}-theme.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export theme:', error);
    }
  };

  const handleImport = () => {
    try {
      setImportError('');
      importTheme(importJson);
      setImportJson('');
      setShowImport(false);
    } catch (error) {
      setImportError('Invalid theme JSON. Please check the format and try again.');
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setImportJson(content);
      };
      reader.readAsText(file);
    }
  };

  const themeOptions = themes.map(t => ({
    value: t.id,
    label: t.name,
  }));

  const presetThemes = themes.filter(t => !customThemes.some(ct => ct.id === t.id));
  
  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/settings">
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={20} />}>
            Back
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <Palette size={32} style={{ color: theme.colors.primary }} />
          <div>
            <h1 className="text-3xl font-bold" style={{ color: theme.colors.text }}>
              Theme Settings
            </h1>
            <p className="text-sm mt-1" style={{ color: theme.colors.textMuted }}>
              Customize the appearance of your GECK interface
            </p>
          </div>
        </div>
      </div>

      {/* Theme Selection */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold" style={{ color: theme.colors.text }}>
            Active Theme
          </h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block mb-2 text-sm" style={{ color: theme.colors.textSecondary }}>
                Select Theme
              </label>
              <Select
                value={theme.id}
                onChange={handleThemeChange}
                options={themeOptions}
                placeholder="Select a theme"
              />
            </div>

            <div className="p-4 rounded" style={{ 
              backgroundColor: theme.colors.surface,
              border: `1px solid ${theme.colors.border}`
            }}>
              <p className="text-sm mb-2" style={{ color: theme.colors.textMuted }}>
                Current Theme: <strong style={{ color: theme.colors.primary }}>{theme.name}</strong>
              </p>
              {theme.description && (
                <p className="text-sm" style={{ color: theme.colors.textMuted }}>
                  {theme.description}
                </p>
              )}
              {theme.author && (
                <p className="text-xs mt-2" style={{ color: theme.colors.textMuted }}>
                  Author: {theme.author} • Version: {theme.version || '1.0.0'}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preset Themes */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold" style={{ color: theme.colors.text }}>
            Preset Themes
          </h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {presetThemes.map(t => (
              <div
                key={t.id}
                className="p-4 rounded flex justify-between items-center transition-all"
                style={{ 
                  backgroundColor: theme.colors.surface,
                  border: `2px solid ${t.id === theme.id ? theme.colors.primary : theme.colors.border}`,
                  boxShadow: t.id === theme.id ? theme.effects.shadow.md : 'none'
                }}
              >
                <div className="flex-1">
                  <h3 className="font-medium" style={{ color: theme.colors.text }}>
                    {t.name}
                  </h3>
                  {t.description && (
                    <p className="text-sm mt-1" style={{ color: theme.colors.textMuted }}>
                      {t.description}
                    </p>
                  )}
                  <div className="flex gap-4 mt-2">
                    <span className="text-xs" style={{ color: theme.colors.textMuted }}>
                      Mode: {t.isDark ? 'Dark' : 'Light'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  {t.id === theme.id && (
                    <span className="px-2 py-1 text-xs rounded" style={{
                      backgroundColor: theme.colors.primaryBackground,
                      color: theme.colors.primary,
                      border: `1px solid ${theme.colors.primaryBorder}`
                    }}>
                      Active
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Download size={16} />}
                    onClick={() => handleExport(t.id)}
                    title="Export theme"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Custom Themes */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold" style={{ color: theme.colors.text }}>
              Custom Themes
            </h2>
            <Button
              size="sm"
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => setShowImport(!showImport)}
            >
              Import Theme
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showImport && (
            <div className="mb-6 p-4 rounded" style={{ 
              backgroundColor: theme.colors.surface,
              border: `1px solid ${theme.colors.border}`
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block mb-2 text-sm font-medium" style={{ color: theme.colors.textSecondary }}>
                    Import from File
                  </label>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleFileImport}
                    className="block w-full text-sm"
                    style={{ color: theme.colors.text }}
                  />
                </div>
                
                <div>
                  <label className="block mb-2 text-sm font-medium" style={{ color: theme.colors.textSecondary }}>
                    Or Paste JSON
                  </label>
                  <textarea
                    value={importJson}
                    onChange={(e) => setImportJson(e.target.value)}
                    placeholder="Paste theme JSON here..."
                    rows={6}
                    className="w-full p-3 rounded font-mono text-sm"
                    style={{
                      backgroundColor: theme.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.9)',
                      border: `1px solid ${theme.colors.border}`,
                      color: theme.colors.text,
                    }}
                  />
                </div>

                {importError && (
                  <div className="p-3 rounded text-sm" style={{
                    backgroundColor: `${theme.colors.danger}20`,
                    border: `1px solid ${theme.colors.danger}`,
                    color: theme.colors.danger,
                  }}>
                    {importError}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handleImport}
                    disabled={!importJson}
                  >
                    Import
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setShowImport(false);
                      setImportJson('');
                      setImportError('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {customThemes.length === 0 ? (
            <div className="text-center py-8 rounded" style={{ 
              backgroundColor: theme.colors.surface,
              border: `1px dashed ${theme.colors.border}`
            }}>
              <Palette size={48} style={{ color: theme.colors.textMuted, margin: '0 auto', marginBottom: '1rem' }} />
              <p style={{ color: theme.colors.textMuted }}>
                No custom themes installed
              </p>
              <p className="text-sm mt-2" style={{ color: theme.colors.textMuted }}>
                Import a theme JSON file to get started
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customThemes.map(t => (
                <div
                  key={t.id}
                  className="p-4 rounded flex justify-between items-center transition-all"
                  style={{ 
                    backgroundColor: theme.colors.surface,
                    border: `2px solid ${t.id === theme.id ? theme.colors.primary : theme.colors.border}`,
                    boxShadow: t.id === theme.id ? theme.effects.shadow.md : 'none'
                  }}
                >
                  <div className="flex-1">
                    <h3 className="font-medium" style={{ color: theme.colors.text }}>
                      {t.name}
                    </h3>
                    {t.description && (
                      <p className="text-sm mt-1" style={{ color: theme.colors.textMuted }}>
                        {t.description}
                      </p>
                    )}
                    <div className="flex gap-4 mt-2">
                      <span className="text-xs" style={{ color: theme.colors.textMuted }}>
                        Mode: {t.isDark ? 'Dark' : 'Light'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    {t.id === theme.id && (
                      <span className="px-2 py-1 text-xs rounded" style={{
                        backgroundColor: theme.colors.primaryBackground,
                        color: theme.colors.primary,
                        border: `1px solid ${theme.colors.primaryBorder}`
                      }}>
                        Active
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Download size={16} />}
                      onClick={() => handleExport(t.id)}
                      title="Export theme"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 size={16} />}
                      onClick={() => removeCustomTheme(t.id)}
                      title="Remove theme"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Theme Preview */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold" style={{ color: theme.colors.text }}>
              Component Preview
            </h2>
            <Button
              size="sm"
              variant="ghost"
              icon={<Eye size={16} />}
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? 'Hide' : 'Show'} Preview
            </Button>
          </div>
        </CardHeader>
        {showPreview && (
          <CardContent>
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-3" style={{ color: theme.colors.text }}>
                  Buttons
                </h3>
                <div className="flex gap-3 flex-wrap">
                  <Button variant="primary">Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="danger">Danger</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="primary" disabled>Disabled</Button>
                  <Button variant="primary" loading>Loading</Button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3" style={{ color: theme.colors.text }}>
                  Form Elements
                </h3>
                <div className="space-y-3 max-w-md">
                  <Input placeholder="Text input" />
                  <Input placeholder="Error input" error />
                  <Select
                    placeholder="Select an option"
                    options={[
                      { value: 'option1', label: 'Option 1' },
                      { value: 'option2', label: 'Option 2' },
                      { value: 'option3', label: 'Option 3' },
                    ]}
                  />
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3" style={{ color: theme.colors.text }}>
                  Cards
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card variant="default">
                    <CardContent>
                      <p style={{ color: theme.colors.text }}>Default Card</p>
                    </CardContent>
                  </Card>
                  <Card variant="bordered">
                    <CardContent>
                      <p style={{ color: theme.colors.text }}>Bordered Card</p>
                    </CardContent>
                  </Card>
                  <Card variant="elevated">
                    <CardContent>
                      <p style={{ color: theme.colors.text }}>Elevated Card</p>
                    </CardContent>
                  </Card>
                  <Card variant="default" interactive>
                    <CardContent>
                      <p style={{ color: theme.colors.text }}>Interactive Card (Hover me)</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3" style={{ color: theme.colors.text }}>
                  Color Palette
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {Object.entries(theme.colors).filter(([key]) => 
                    !key.includes('Hover') && !key.includes('Active') && 
                    !key.includes('Border') && !key.includes('Background') && 
                    !key.includes('Shadow') && !key.includes('Muted') && 
                    !key.includes('Inverse') && !key.includes('placeholder')
                  ).map(([key, value]) => (
                    <div key={key} className="text-center">
                      <div 
                        className="w-full h-16 rounded mb-2 border"
                        style={{ 
                          backgroundColor: value,
                          borderColor: theme.colors.border
                        }}
                      />
                      <p className="text-xs font-medium" style={{ color: theme.colors.text }}>
                        {key}
                      </p>
                      <p className="text-xs opacity-60" style={{ color: theme.colors.textMuted }}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium mb-3" style={{ color: theme.colors.text }}>
                  Typography
                </h3>
                <div className="space-y-2">
                  <p style={{ fontSize: theme.typography.fontSize['3xl'], color: theme.colors.text }}>
                    Heading 3XL - {theme.typography.fontSize['3xl']}
                  </p>
                  <p style={{ fontSize: theme.typography.fontSize['2xl'], color: theme.colors.text }}>
                    Heading 2XL - {theme.typography.fontSize['2xl']}
                  </p>
                  <p style={{ fontSize: theme.typography.fontSize.xl, color: theme.colors.text }}>
                    Heading XL - {theme.typography.fontSize.xl}
                  </p>
                  <p style={{ fontSize: theme.typography.fontSize.lg, color: theme.colors.text }}>
                    Large Text - {theme.typography.fontSize.lg}
                  </p>
                  <p style={{ fontSize: theme.typography.fontSize.base, color: theme.colors.text }}>
                    Base Text - {theme.typography.fontSize.base}
                  </p>
                  <p style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.textSecondary }}>
                    Small Text - {theme.typography.fontSize.sm}
                  </p>
                  <p style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.textMuted }}>
                    Extra Small - {theme.typography.fontSize.xs}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};