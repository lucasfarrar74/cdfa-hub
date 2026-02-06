import { useState } from 'react';
import { useBudget } from '../context/BudgetContext';
import type { Cooperator, ExpenseCategory, ExpenseTemplate } from '../types';

type SettingsTab = 'cooperators' | 'categories' | 'templates' | 'data';

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('cooperators');

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'cooperators', label: 'Cooperators' },
    { id: 'categories', label: 'Categories' },
    { id: 'templates', label: 'Templates' },
    { id: 'data', label: 'Data' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage reference data and configuration</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex space-x-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'cooperators' && <CooperatorsSection />}
      {activeTab === 'categories' && <CategoriesSection />}
      {activeTab === 'templates' && <TemplatesSection />}
      {activeTab === 'data' && <DataSection />}
    </div>
  );
}

// --- Cooperators ---
function CooperatorsSection() {
  const { cooperators, activities, createCooperator, updateCooperator, deleteCooperator } = useBudget();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Cooperator | null>(null);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [fullName, setFullName] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setName(''); setFullName(''); setContactName(''); setEmail('');
    setPhone(''); setAddress(''); setNotes('');
    setEditing(null); setShowForm(false); setError('');
  };

  const startEdit = (c: Cooperator) => {
    setEditing(c);
    setName(c.name); setFullName(c.full_name || '');
    setContactName(c.contact_name || ''); setEmail(c.email || '');
    setPhone(c.phone || ''); setAddress(c.address || ''); setNotes(c.notes || '');
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const data = {
      name: name.trim(),
      full_name: fullName.trim() || null,
      contact_name: contactName.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    if (editing) {
      updateCooperator(editing.id, data);
    } else {
      createCooperator(data);
    }
    resetForm();
  };

  const handleDelete = (id: number) => {
    const success = deleteCooperator(id);
    if (!success) {
      setError('Cannot delete: cooperator is referenced by activities.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Cooperators</h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          + Add Cooperator
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm rounded-lg">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Full Name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Contact</label>
              <input value={contactName} onChange={e => setContactName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Phone</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Address</label>
              <input value={address} onChange={e => setAddress(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetForm} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
              Cancel
            </button>
            <button type="submit" className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
              {editing ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      )}

      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Name</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Full Name</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Contact</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Email</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400"># Activities</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {cooperators.map(c => {
            const actCount = activities.filter(a => a.cooperator_id === c.id).length;
            return (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">{c.name}</td>
                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{c.full_name || '-'}</td>
                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{c.contact_name || '-'}</td>
                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{c.email || '-'}</td>
                <td className="px-4 py-2 text-right text-sm text-gray-600 dark:text-gray-400">{actCount}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => startEdit(c)} className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 mr-2">Edit</button>
                  <button onClick={() => handleDelete(c.id)} className="text-xs text-red-500 hover:text-red-700 dark:text-red-400">Delete</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {cooperators.length === 0 && (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">No cooperators. Add one to get started.</div>
      )}
    </div>
  );
}

// --- Categories ---
function CategoriesSection() {
  const { categories, allExpenses, createCategory, updateCategory, deleteCategory } = useBudget();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ExpenseCategory | null>(null);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const resetForm = () => {
    setName(''); setDescription('');
    setEditing(null); setShowForm(false); setError('');
  };

  const startEdit = (c: ExpenseCategory) => {
    setEditing(c);
    setName(c.name); setDescription(c.description || '');
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editing) {
      updateCategory(editing.id, { name: name.trim(), description: description.trim() || null });
    } else {
      createCategory({ name: name.trim(), description: description.trim() || null });
    }
    resetForm();
  };

  const handleDelete = (id: number) => {
    const success = deleteCategory(id);
    if (!success) {
      setError('Cannot delete: category is referenced by expenses.');
      setTimeout(() => setError(''), 3000);
    }
  };

  const getExpenseCount = (catId: number) => {
    return Object.values(allExpenses).flat().filter(e => e.category_id === catId).length;
  };

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Expense Categories</h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          + Add Category
        </button>
      </div>

      {error && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm rounded-lg">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
              <input value={description} onChange={e => setDescription(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetForm} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
              Cancel
            </button>
            <button type="submit" className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
              {editing ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      )}

      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-700/50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Name</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Description</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400"># Expenses</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {categories.map(c => (
            <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">{c.name}</td>
              <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{c.description || '-'}</td>
              <td className="px-4 py-2 text-right text-sm text-gray-600 dark:text-gray-400">{getExpenseCount(c.id)}</td>
              <td className="px-4 py-2 text-right">
                <button onClick={() => startEdit(c)} className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 mr-2">Edit</button>
                <button onClick={() => handleDelete(c.id)} className="text-xs text-red-500 hover:text-red-700 dark:text-red-400">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {categories.length === 0 && (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">No categories. Add one to get started.</div>
      )}
    </div>
  );
}

// --- Templates ---
function TemplatesSection() {
  const { templates, categories, createTemplate, updateTemplate, deleteTemplate } = useBudget();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ExpenseTemplate | null>(null);

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [defaultAmount, setDefaultAmount] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setName(''); setCategoryId(''); setDescription(''); setDefaultAmount(''); setNotes('');
    setEditing(null); setShowForm(false);
  };

  const startEdit = (t: ExpenseTemplate) => {
    setEditing(t);
    setName(t.name); setCategoryId(t.category_id);
    setDescription(t.description); setDefaultAmount(t.default_amount.toString());
    setNotes(t.notes);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !categoryId) return;

    const data = {
      name: name.trim(),
      category_id: Number(categoryId),
      description: description.trim(),
      default_amount: Number(defaultAmount.replace(/[^0-9.-]/g, '')) || 0,
      notes: notes.trim(),
    };

    if (editing) {
      updateTemplate(editing.id, data);
    } else {
      createTemplate(data);
    }
    resetForm();
  };

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Expense Templates</h2>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          + Add Template
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Template Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} className={inputCls} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Category *</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : '')} className={inputCls} required>
                <option value="">Select...</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</label>
              <input value={description} onChange={e => setDescription(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Default Amount</label>
              <input value={defaultAmount} onChange={e => setDefaultAmount(e.target.value)} placeholder="$0" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetForm} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400">Cancel</button>
            <button type="submit" className="px-3 py-1.5 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
              {editing ? 'Save' : 'Add'}
            </button>
          </div>
        </form>
      )}

      {templates.length === 0 ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-sm">
          No templates yet. Templates pre-fill expense forms for common expenses.
        </div>
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Name</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Category</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Description</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Amount</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {templates.map(t => (
              <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">{t.name}</td>
                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{categories.find(c => c.id === t.category_id)?.name || '-'}</td>
                <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">{t.description || '-'}</td>
                <td className="px-4 py-2 text-right text-sm text-gray-900 dark:text-gray-100">${t.default_amount.toLocaleString()}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => startEdit(t)} className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 mr-2">Edit</button>
                  <button onClick={() => deleteTemplate(t.id)} className="text-xs text-red-500 hover:text-red-700 dark:text-red-400">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// --- Data Management ---
function DataSection() {
  const { loadSampleData, exportToJSON, importFromJSON } = useBudget();
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState('');

  const handleExport = () => {
    const json = exportToJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'budget-data.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setMessage('Data exported successfully.');
    setTimeout(() => setMessage(''), 3000);
  };

  const handleImport = () => {
    if (!importText.trim()) return;
    const success = importFromJSON(importText);
    if (success) {
      setMessage('Data imported successfully.');
      setImportText('');
    } else {
      setMessage('Invalid data format. Import failed.');
    }
    setTimeout(() => setMessage(''), 3000);
  };

  const handleResetToSample = () => {
    if (confirm('This will replace all current data with sample data. Continue?')) {
      loadSampleData();
      setMessage('Sample data loaded.');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className={`px-4 py-3 rounded-lg text-sm ${message.includes('failed') ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'}`}>
          {message}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Export Data</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Download all budget data as JSON.</p>
        <button onClick={handleExport} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
          Download JSON
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Import Data</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Paste exported JSON to replace all current data.</p>
        <textarea
          value={importText}
          onChange={e => setImportText(e.target.value)}
          placeholder="Paste JSON data here..."
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono"
          rows={6}
        />
        <button
          onClick={handleImport}
          disabled={!importText.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg transition-colors"
        >
          Import
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Reset Data</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">Replace all data with sample data for testing.</p>
        <button onClick={handleResetToSample} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
          Reset to Sample Data
        </button>
      </div>
    </div>
  );
}
