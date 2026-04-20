import { useState } from 'react';
import { useProjects } from '../context/ProjectsContext';
import type { StaffMember, StaffRole } from '../types';

const ROLE_LABELS: Record<StaffRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  coordinator: 'Coordinator',
  specialist: 'Specialist',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<StaffRole, string> = {
  admin: 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200',
  manager: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200',
  coordinator: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200',
  specialist: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200',
  viewer: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
};

function StaffFormModal({
  member,
  onSave,
  onClose,
}: {
  member?: StaffMember;
  onSave: (data: Omit<StaffMember, 'id'>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(member?.name || '');
  const [email, setEmail] = useState(member?.email || '');
  const [role, setRole] = useState<StaffRole>(member?.role || 'coordinator');
  const [isActive, setIsActive] = useState(member?.isActive ?? true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), email: email.trim(), role, isActive });
  };

  const inputCls = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 mx-4 max-w-md w-full" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {member ? 'Edit Team Member' : 'Add Team Member'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inputCls} required autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
            <select value={role} onChange={e => setRole(e.target.value as StaffRole)} className={inputCls}>
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300">Active</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
              {member ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StaffDirectory() {
  const { staffMembers, activities, addStaffMember, updateStaffMember, removeStaffMember } = useProjects();
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffMember | undefined>(undefined);
  const [filterRole, setFilterRole] = useState<StaffRole | 'all'>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const filtered = staffMembers.filter(s => {
    if (filterRole !== 'all' && s.role !== filterRole) return false;
    if (!showInactive && !s.isActive) return false;
    return true;
  });

  const getAssignmentCount = (staffId: string) => {
    return activities.filter(a => a.leadStaffId === staffId || a.teamMemberIds?.includes(staffId)).length;
  };

  const handleSave = (data: Omit<StaffMember, 'id'>) => {
    if (editingMember) {
      updateStaffMember(editingMember.id, data);
    } else {
      addStaffMember(data);
    }
    setShowForm(false);
    setEditingMember(undefined);
  };

  const handleRemove = (id: string) => {
    const success = removeStaffMember(id);
    if (!success) {
      setRemoveError('Cannot remove — this member is assigned to activities. Unassign them first, or set them as inactive.');
      setTimeout(() => setRemoveError(null), 4000);
    }
  };

  return (
    <div className="space-y-4 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Team Directory</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">{staffMembers.length} members ({staffMembers.filter(s => s.isActive).length} active)</p>
        </div>
        <button
          onClick={() => { setEditingMember(undefined); setShowForm(true); }}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          + Add Member
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={filterRole}
          onChange={e => setFilterRole(e.target.value as StaffRole | 'all')}
          className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="all">All Roles</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="w-4 h-4 rounded" />
          Show inactive
        </label>
      </div>

      {removeError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
          {removeError}
        </div>
      )}

      {/* Staff list */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
          {staffMembers.length === 0 ? 'No team members yet. Click "+ Add Member" to get started.' : 'No members match the current filters.'}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.map(member => {
              const assignmentCount = getAssignmentCount(member.id);
              return (
                <div key={member.id} className="px-4 py-3 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    member.isActive
                      ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    {member.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${member.isActive ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
                        {member.name}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[member.role]}`}>
                        {ROLE_LABELS[member.role]}
                      </span>
                      {!member.isActive && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {member.email}
                      {assignmentCount > 0 && (
                        <span className="ml-2">· {assignmentCount} {assignmentCount === 1 ? 'activity' : 'activities'}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => { setEditingMember(member); setShowForm(true); }}
                      className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleRemove(member.id)}
                      className="px-2 py-1 text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showForm && (
        <StaffFormModal
          member={editingMember}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingMember(undefined); }}
        />
      )}
    </div>
  );
}
