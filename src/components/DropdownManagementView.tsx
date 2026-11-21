import React, { useState } from 'react';
import {
  AlertCircle,
  Briefcase,
  Check,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { DropdownOption } from '../types/recruitment';
import { FIELD_LIMITS } from '../utils/validation';

interface DropdownManagementViewProps {
  managers: DropdownOption[];
  clients: DropdownOption[];
  onAddOption: (collectionName: 'managers' | 'clients', name: string) => Promise<void>;
  onUpdateOption: (
    collectionName: 'managers' | 'clients',
    optionId: string,
    updates: { name?: string; isActive?: boolean }
  ) => Promise<void>;
  onDeleteOption: (collectionName: 'managers' | 'clients', optionId: string) => Promise<void>;
  onSeedDefaults: (collectionName: 'managers' | 'clients') => Promise<void>;
}

interface OptionColumnProps {
  title: string;
  subtitle: string;
  collectionName: 'managers' | 'clients';
  placeholder: string;
  maxLength: number;
  icon: React.ComponentType<{ className?: string }>;
  options: DropdownOption[];
  onAdd: (name: string) => Promise<void>;
  onUpdate: (optionId: string, updates: { name?: string; isActive?: boolean }) => Promise<void>;
  onDelete: (optionId: string) => Promise<void>;
  onSeedDefaults: () => Promise<void>;
}

function OptionManagementPanel({
  title,
  subtitle,
  collectionName,
  placeholder,
  maxLength,
  icon: Icon,
  options,
  onAdd,
  onUpdate,
  onDelete,
  onSeedDefaults,
}: OptionColumnProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const trimmed = newName.trim();
    if (!trimmed) {
      setErrorMsg(`Enter a ${collectionName === 'managers' ? 'manager' : 'client'} name first.`);
      return;
    }
    const duplicate = options.some((opt) => opt.name.toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      setErrorMsg(`"${trimmed}" already exists in this dropdown list.`);
      return;
    }

    setAdding(true);
    try {
      await onAdd(trimmed);
      setNewName('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to add option.');
    } finally {
      setAdding(false);
    }
  };

  const startEditing = (opt: DropdownOption) => {
    setErrorMsg(null);
    setEditingId(opt.id);
    setEditingValue(opt.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingValue('');
    setErrorMsg(null);
  };

  const saveEdit = async (opt: DropdownOption) => {
    setErrorMsg(null);
    const trimmed = editingValue.trim();
    if (!trimmed) {
      setErrorMsg('Name cannot be empty.');
      return;
    }
    const duplicate = options.some(
      (item) => item.id !== opt.id && item.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (duplicate) {
      setErrorMsg(`"${trimmed}" already exists in this dropdown list.`);
      return;
    }

    setBusyId(opt.id);
    try {
      await onUpdate(opt.id, { name: trimmed });
      setEditingId(null);
      setEditingValue('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to rename option.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (opt: DropdownOption) => {
    setErrorMsg(null);
    setBusyId(opt.id);
    try {
      await onDelete(opt.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to remove option.');
    } finally {
      setBusyId(null);
    }
  };

  const handleSeed = async () => {
    setErrorMsg(null);
    setSeeding(true);
    try {
      await onSeedDefaults();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load default entries.');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
      <div className="px-6 py-5 border-b border-slate-200 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
        <span className="text-xs font-mono tabular-nums text-slate-500 whitespace-nowrap">
          {options.length} {options.length === 1 ? 'option' : 'options'}
        </span>
      </div>

      {/* Add new option bar */}
      <form onSubmit={handleAddSubmit} className="p-5 bg-slate-50/70 border-b border-slate-200">
        <label
          htmlFor={`add-${collectionName}-input`}
          className="block text-xs font-semibold text-slate-700 mb-1.5"
        >
          Add new {collectionName === 'managers' ? 'Manager Name' : 'Client Name'}
        </label>
        <div className="flex items-center gap-2">
          <input
            id={`add-${collectionName}-input`}
            type="text"
            maxLength={maxLength}
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setErrorMsg(null);
            }}
            placeholder={placeholder}
            className="flex-1 px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-600/20 focus:border-red-600"
          />
          <button
            type="submit"
            disabled={adding}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors disabled:opacity-60 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{adding ? 'Adding...' : 'Add'}</span>
          </button>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}
      </form>

      {/* Options list */}
      <div className="divide-y divide-slate-100 flex-1">
        {options.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              No {collectionName === 'managers' ? 'managers' : 'clients'} configured yet.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Add entries above or load the standard starter list.
            </p>
            <button
              type="button"
              disabled={seeding}
              onClick={handleSeed}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {seeding ? 'Loading Defaults...' : 'Load Starter List'}
            </button>
          </div>
        ) : (
          options.map((opt) => {
            const isEditing = editingId === opt.id;
            const isBusy = busyId === opt.id;

            return (
              <div
                key={opt.id}
                className="px-6 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                {isEditing ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      aria-label={`Edit ${opt.name}`}
                      maxLength={maxLength}
                      value={editingValue}
                      onChange={(e) => setEditingValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          saveEdit(opt);
                        } else if (e.key === 'Escape') {
                          cancelEditing();
                        }
                      }}
                      autoFocus
                      className="flex-1 px-3 py-1.5 text-sm bg-white border border-red-400 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-600/20"
                    />
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => saveEdit(opt)}
                      aria-label={`Save ${opt.name}`}
                      className="p-1.5 text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={cancelEditing}
                      aria-label="Cancel rename"
                      className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-md transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-medium text-slate-800 truncate">{opt.name}</span>
                    <div className="inline-flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => startEditing(opt)}
                        aria-label={`Edit ${opt.name}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleDelete(opt)}
                        aria-label={`Delete ${opt.name}`}
                        className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export function DropdownManagementView({
  managers,
  clients,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  onSeedDefaults,
}: DropdownManagementViewProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl px-6 py-5">
        <h2 className="text-base font-bold text-slate-900">
          Data Entry Form Dropdown Management
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Changes made here immediately update the <strong>Manager Name</strong> and{' '}
          <strong>Client Name</strong> dropdown lists in the Data Entry Form for all recruiters and
          administrators.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <OptionManagementPanel
          title="Manager Names"
          subtitle="Populates Field 2 (Manager Name) dropdown in Data Entry Form"
          collectionName="managers"
          placeholder="e.g., Rajesh Khanna"
          maxLength={FIELD_LIMITS.managerNameMax}
          icon={UserCheck}
          options={managers}
          onAdd={(name) => onAddOption('managers', name)}
          onUpdate={(id, updates) => onUpdateOption('managers', id, updates)}
          onDelete={(id) => onDeleteOption('managers', id)}
          onSeedDefaults={() => onSeedDefaults('managers')}
        />

        <OptionManagementPanel
          title="Client Names"
          subtitle="Populates Field 4 (Client Name) dropdown in Data Entry Form"
          collectionName="clients"
          placeholder="e.g., Zudio Retail"
          maxLength={FIELD_LIMITS.clientNameMax}
          icon={Briefcase}
          options={clients}
          onAdd={(name) => onAddOption('clients', name)}
          onUpdate={(id, updates) => onUpdateOption('clients', id, updates)}
          onDelete={(id) => onDeleteOption('clients', id)}
          onSeedDefaults={() => onSeedDefaults('clients')}
        />
      </div>
    </div>
  );
}
