import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, Edit2, Trash2, Shield, CheckCircle, XCircle } from 'lucide-react';
import { User, UserRole, ROLE_PERMISSIONS } from '../types';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../themes/ThemeContext';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';

export const UsersPage: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser, hasPermission } = useAuth();
  const { theme } = useTheme();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  // Check permission
  const canManageUsers = hasPermission('system', 'manageUsers');

  useEffect(() => {
    if (canManageUsers) {
      loadUsers();
    }
  }, [canManageUsers]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api.users.list();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await api.users.toggleActive(user._id!);
      await loadUsers();
    } catch (error) {
      console.error('Failed to toggle user status:', error);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete?._id) return;
    
    try {
      await api.users.delete(userToDelete._id);
      setShowDeleteConfirm(false);
      setUserToDelete(null);
      await loadUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return theme.colors.danger;
      case 'solutions_engineer':
        return theme.colors.warning || theme.colors.primary;
      case 'technical_implementation_engineer':
      default:
        return theme.colors.success;
    }
  };

  const formatRole = (role: UserRole) => {
    return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  if (!canManageUsers) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: theme.spacing.xl,
        color: theme.colors.textMuted 
      }}>
        <Shield size={48} style={{ 
          margin: '0 auto', 
          marginBottom: theme.spacing.md,
          color: theme.colors.danger 
        }} />
        <h2 style={{ color: theme.colors.danger }}>Access Denied</h2>
        <p>You don't have permission to manage users.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: theme.spacing.lg
      }}>
        <div>
          <h1 style={{ 
            fontSize: theme.typography.fontSize['2xl'],
            color: theme.colors.primary,
            marginBottom: theme.spacing.xs,
            fontFamily: theme.typography.fontFamily.display
          }}>
            USER MANAGEMENT
          </h1>
          <p style={{ 
            color: theme.colors.textMuted,
            fontSize: theme.typography.fontSize.sm 
          }}>
            Manage system users and their permissions
          </p>
        </div>
        <Button
          variant="primary"
          icon={<UserPlus size={20} />}
          onClick={() => setShowAddModal(true)}
        >
          Add User
        </Button>
      </div>

      {/* User Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: theme.spacing.md,
        marginBottom: theme.spacing.xl
      }}>
        <Card style={{ padding: theme.spacing.md }}>
          <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.fontSize.sm }}>
            Total Users
          </div>
          <div style={{ 
            fontSize: theme.typography.fontSize['2xl'], 
            color: theme.colors.primary,
            fontWeight: 'bold'
          }}>
            {users.length}
          </div>
        </Card>
        <Card style={{ padding: theme.spacing.md }}>
          <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.fontSize.sm }}>
            Active Users
          </div>
          <div style={{ 
            fontSize: theme.typography.fontSize['2xl'], 
            color: theme.colors.success,
            fontWeight: 'bold'
          }}>
            {users.filter(u => u.isActive).length}
          </div>
        </Card>
        <Card style={{ padding: theme.spacing.md }}>
          <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.fontSize.sm }}>
            Administrators
          </div>
          <div style={{ 
            fontSize: theme.typography.fontSize['2xl'], 
            color: theme.colors.danger,
            fontWeight: 'bold'
          }}>
            {users.filter(u => u.role === 'admin').length}
          </div>
        </Card>
      </div>

      {/* Users List */}
      {loading ? (
        <Card style={{ 
          padding: theme.spacing.xl, 
          textAlign: 'center',
          color: theme.colors.textMuted 
        }}>
          Loading users...
        </Card>
      ) : users.length === 0 ? (
        <Card style={{ 
          padding: theme.spacing.xl, 
          textAlign: 'center',
          color: theme.colors.textMuted 
        }}>
          <Users size={48} style={{ margin: '0 auto', marginBottom: theme.spacing.md }} />
          <p>No users found. Add your first user to get started.</p>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
          {users.map(user => (
            <Card key={user._id} style={{ padding: theme.spacing.md }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
                  {/* User Avatar */}
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: theme.colors.primaryBackground,
                    border: `2px solid ${theme.colors.primary}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: theme.typography.fontSize.lg,
                    color: theme.colors.primary,
                    fontWeight: 'bold'
                  }}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  
                  {/* User Info */}
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: theme.spacing.sm,
                      marginBottom: theme.spacing.xs
                    }}>
                      <span style={{ 
                        fontSize: theme.typography.fontSize.lg,
                        color: theme.colors.text,
                        fontWeight: 'bold'
                      }}>
                        {user.name}
                      </span>
                      {user._id === currentUser?._id && (
                        <span style={{
                          padding: `2px ${theme.spacing.xs}`,
                          backgroundColor: theme.colors.primaryBackground,
                          color: theme.colors.primary,
                          fontSize: theme.typography.fontSize.xs,
                          borderRadius: theme.borders.radius.sm,
                          border: `1px solid ${theme.colors.primary}`
                        }}>
                          YOU
                        </span>
                      )}
                      <span style={{
                        padding: `2px ${theme.spacing.sm}`,
                        backgroundColor: `${getRoleBadgeColor(user.role)}20`,
                        color: getRoleBadgeColor(user.role),
                        fontSize: theme.typography.fontSize.xs,
                        borderRadius: theme.borders.radius.sm,
                        border: `1px solid ${getRoleBadgeColor(user.role)}`
                      }}>
                        {formatRole(user.role)}
                      </span>
                      {user.isActive ? (
                        <CheckCircle size={16} style={{ color: theme.colors.success }} />
                      ) : (
                        <XCircle size={16} style={{ color: theme.colors.danger }} />
                      )}
                    </div>
                    <div style={{ 
                      fontSize: theme.typography.fontSize.sm,
                      color: theme.colors.textMuted 
                    }}>
                      {user.email} • {user.department || 'No Department'}
                    </div>
                    {user.lastLogin && (
                      <div style={{ 
                        fontSize: theme.typography.fontSize.xs,
                        color: theme.colors.textMuted,
                        marginTop: theme.spacing.xs
                      }}>
                        Last login: {new Date(user.lastLogin).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: theme.spacing.sm }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(user)}
                    disabled={user._id === currentUser?._id}
                  >
                    {user.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Edit2 size={16} />}
                    onClick={() => {
                      setSelectedUser(user);
                      setShowEditModal(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<Trash2 size={16} />}
                    onClick={() => {
                      setUserToDelete(user);
                      setShowDeleteConfirm(true);
                    }}
                    disabled={user._id === currentUser?._id}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <UserFormModal
          mode="add"
          onClose={() => setShowAddModal(false)}
          onSave={async () => {
            setShowAddModal(false);
            await loadUsers();
          }}
        />
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <UserFormModal
          mode="edit"
          user={selectedUser}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
          }}
          onSave={async () => {
            setShowEditModal(false);
            setSelectedUser(null);
            await loadUsers();
          }}
        />
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && userToDelete && (
        <Modal
          isOpen={showDeleteConfirm}
          onClose={() => {
            setShowDeleteConfirm(false);
            setUserToDelete(null);
          }}
          title="Delete User"
        >
          <p style={{ marginBottom: theme.spacing.lg }}>
            Are you sure you want to delete user <strong>{userToDelete.name}</strong>?
            This action cannot be undone.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.sm }}>
            <Button
              variant="secondary"
              onClick={() => {
                setShowDeleteConfirm(false);
                setUserToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteUser}
            >
              Delete User
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

// User Form Modal Component
interface UserFormModalProps {
  mode: 'add' | 'edit';
  user?: User;
  onClose: () => void;
  onSave: () => void;
}

const UserFormModal: React.FC<UserFormModalProps> = ({ mode, user, onClose, onSave }) => {
  const { theme } = useTheme();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || 'technical_implementation_engineer' as UserRole,
    department: user?.department || '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (mode === 'add') {
      if (!formData.password) {
        newErrors.password = 'Password is required';
      } else if (formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters';
      }

      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (mode === 'add') {
        await api.users.create({
          ...formData,
          isActive: true,
          permissions: ROLE_PERMISSIONS[formData.role]
        });
      } else if (user?._id) {
        await api.users.update(user._id, {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          department: formData.department
        });
      }
      onSave();
    } catch (error) {
      console.error('Failed to save user:', error);
      setErrors({ submit: 'Failed to save user. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={mode === 'add' ? 'Add New User' : 'Edit User'}
    >
      <form onSubmit={handleSubmit}>
        {errors.submit && (
          <div style={{
            padding: theme.spacing.sm,
            backgroundColor: `${theme.colors.danger}20`,
            border: `1px solid ${theme.colors.danger}`,
            borderRadius: theme.borders.radius.md,
            color: theme.colors.danger,
            marginBottom: theme.spacing.md
          }}>
            {errors.submit}
          </div>
        )}

        <div style={{ marginBottom: theme.spacing.md }}>
          <label style={{
            display: 'block',
            marginBottom: theme.spacing.xs,
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.textSecondary
          }}>
            Name
          </label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="John Doe"
            required
          />
          {errors.name && (
            <span style={{ color: theme.colors.danger, fontSize: theme.typography.fontSize.xs }}>
              {errors.name}
            </span>
          )}
        </div>

        <div style={{ marginBottom: theme.spacing.md }}>
          <label style={{
            display: 'block',
            marginBottom: theme.spacing.xs,
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.textSecondary
          }}>
            Email
          </label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="john@example.com"
            required
          />
          {errors.email && (
            <span style={{ color: theme.colors.danger, fontSize: theme.typography.fontSize.xs }}>
              {errors.email}
            </span>
          )}
        </div>

        <div style={{ marginBottom: theme.spacing.md }}>
          <label style={{
            display: 'block',
            marginBottom: theme.spacing.xs,
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.textSecondary
          }}>
            Role
          </label>
          <Select
            value={formData.role}
            onChange={(value) => setFormData({ ...formData, role: value as UserRole })}
            options={[
              { value: 'technical_implementation_engineer', label: 'Technical Implementation Engineer' },
              { value: 'solutions_engineer', label: 'Solutions Engineer' },
              { value: 'admin', label: 'System Administrator' }
            ]}
          />
        </div>

        <div style={{ marginBottom: theme.spacing.md }}>
          <label style={{
            display: 'block',
            marginBottom: theme.spacing.xs,
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.textSecondary
          }}>
            Department
          </label>
          <Input
            value={formData.department}
            onChange={(e) => setFormData({ ...formData, department: e.target.value })}
            placeholder="Engineering"
          />
        </div>

        {mode === 'add' && (
          <>
            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{
                display: 'block',
                marginBottom: theme.spacing.xs,
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.textSecondary
              }}>
                Password
              </label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                required
              />
              {errors.password && (
                <span style={{ color: theme.colors.danger, fontSize: theme.typography.fontSize.xs }}>
                  {errors.password}
                </span>
              )}
            </div>

            <div style={{ marginBottom: theme.spacing.md }}>
              <label style={{
                display: 'block',
                marginBottom: theme.spacing.xs,
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.textSecondary
              }}>
                Confirm Password
              </label>
              <Input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="••••••••"
                required
              />
              {errors.confirmPassword && (
                <span style={{ color: theme.colors.danger, fontSize: theme.typography.fontSize.xs }}>
                  {errors.confirmPassword}
                </span>
              )}
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.sm }}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            {mode === 'add' ? 'Add User' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};