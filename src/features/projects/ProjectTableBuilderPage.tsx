import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Table, Trash2, Save } from 'lucide-react'

type ColumnType = 'short_text' | 'long_text' | 'number' | 'date' | 'dropdown' | 'status' | 'staff_member' | 'checkbox' | 'attachment'

const COLUMN_TYPES: { value: ColumnType; label: string }[] = [
  { value: 'short_text', label: 'Short text' },
  { value: 'long_text', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'status', label: 'Status' },
  { value: 'staff_member', label: 'Staff member' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'attachment', label: 'Attachment' },
]

export default function ProjectTableBuilderPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [tables, setTables] = useState<any[]>([])
  const [columns, setColumns] = useState<any[]>([])
  const [rows, setRows] = useState<any[]>([])

  const [newTableTitle, setNewTableTitle] = useState('')
  const [newTableDesc, setNewTableDesc] = useState('')
  const [creatingTable, setCreatingTable] = useState(false)

  const [newColName, setNewColName] = useState('')
  const [newColType, setNewColType] = useState<ColumnType>('short_text')
  const [newColOptions, setNewColOptions] = useState('')
  const [newColRequired, setNewColRequired] = useState(false)
  const [creatingColumn, setCreatingColumn] = useState(false)

  const [editingRow, setEditingRow] = useState<any | null>(null)
  const [rowData, setRowData] = useState<any>({})

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
      setProjects(data ?? [])
    } catch (e: any) {
      console.error(e)
    }
  }

  const selectProject = async (projectId: string) => {
    setSelectedProject(projectId)
    setTables([])
    setColumns([])
    setRows([])
    try {
      const { data } = await supabase.from('project_tables').select('*').eq('project_id', projectId).order('created_at', { ascending: true })
      setTables(data ?? [])
    } catch (e: any) {
      console.error(e)
    }
  }

  const loadColumns = async (tableId: string) => {
    try {
      const { data } = await supabase.from('project_table_columns').select('*').eq('table_id', tableId).order('position', { ascending: true })
      setColumns(data ?? [])
    } catch (e: any) {
      console.error(e)
    }
  }

  const loadRows = async (tableId: string) => {
    try {
      const { data } = await supabase.from('project_table_rows').select('*').eq('table_id', tableId).order('created_at', { ascending: true })
      setRows(data ?? [])
    } catch (e: any) {
      console.error(e)
    }
  }

  const createTable = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProject || !newTableTitle.trim()) return
    setCreatingTable(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('project_tables').insert([
        { project_id: selectedProject, title: newTableTitle, description: newTableDesc, created_by: user?.id },
      ])
      if (error) throw error
      setNewTableTitle('')
      setNewTableDesc('')
      await selectProject(selectedProject)
    } catch (err: any) {
      alert(err.message || 'Failed to create table')
    } finally {
      setCreatingTable(false)
    }
  }

  const createColumn = async (e: React.FormEvent) => {
    e.preventDefault()
    const activeTable = editingRow && editingRow.id ? tables.find((t) => t.id === editingRow.id) : tables[0]
    const tableId = activeTable?.id
    if (!tableId || !newColName.trim()) return
    setCreatingColumn(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const options = newColType === 'dropdown' || newColType === 'status' ? (newColOptions.split(',').map((o) => o.trim()).filter(Boolean)) : []
      const { error } = await supabase.from('project_table_columns').insert([
        {
          table_id: tableId,
          name: newColName,
          column_type: newColType,
          options,
          is_required: newColRequired,
          position: columns.length,
          created_by: user?.id,
        },
      ])
      if (error) throw error
      setNewColName('')
      setNewColOptions('')
      setNewColRequired(false)
      await loadColumns(tableId)
    } catch (err: any) {
      alert(err.message || 'Failed to create column')
    } finally {
      setCreatingColumn(false)
    }
  }

  const createRow = async () => {
    const activeTable = editingRow && editingRow.id ? tables.find((t) => t.id === editingRow.id) : tables[0]
    const tableId = activeTable?.id
    if (!tableId) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('project_table_rows').insert([
        { table_id: tableId, data: rowData, created_by: user?.id },
      ])
      if (error) throw error
      setRowData({})
      setEditingRow(null)
      await loadRows(tableId)
    } catch (err: any) {
      alert(err.message || 'Failed to create row')
    }
  }

  const updateRow = async () => {
    if (!editingRow) return
    try {
      const { error } = await supabase.from('project_table_rows').update({ data: rowData }).eq('id', editingRow.id)
      if (error) throw error
      setRowData({})
      setEditingRow(null)
      const tableId = editingRow.table_id
      await loadRows(tableId)
    } catch (err: any) {
      alert(err.message || 'Failed to update row')
    }
  }

  const deleteRow = async (rowId: string, tableId: string) => {
    if (!confirm('Delete this row?')) return
    try {
      await supabase.from('project_table_rows').delete().eq('id', rowId)
      await loadRows(tableId)
    } catch (err: any) {
      alert(err.message || 'Failed to delete row')
    }
  }

  const deleteColumn = async (colId: string, tableId: string) => {
    if (!confirm('Delete this column?')) return
    try {
      await supabase.from('project_table_columns').delete().eq('id', colId)
      await loadColumns(tableId)
    } catch (err: any) {
      alert(err.message || 'Failed to delete column')
    }
  }

  const deleteTable = async (tableId: string) => {
    if (!confirm('Delete this table and all its data?')) return
    try {
      await supabase.from('project_tables').delete().eq('id', tableId)
      await selectProject(selectedProject!)
    } catch (err: any) {
      alert(err.message || 'Failed to delete table')
    }
  }

  const cellValue = (row: any, col: any) => {
    return row.data?.[col.name] ?? ''
  }

  const handleCellChange = (row: any, col: any, value: any) => {
    if (editingRow && editingRow.id === row.id) {
      setRowData({ ...rowData, [col.name]: value })
    } else {
      supabase.from('project_table_rows').update({ data: { ...row.data, [col.name]: value } }).eq('id', row.id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Custom Project Tables</h2>
          <p className="text-sm text-neutral-500">Build lightweight trackers inside each project (stakeholder register, outreach tracker, deliverables, etc.).</p>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-3">
          <Table className="w-4 h-4 text-brand-600" />
          <label className="text-sm font-medium text-neutral-700">Project</label>
          <select
            className="input"
            value={selectedProject ?? ''}
            onChange={(e) => selectProject(e.target.value)}
          >
            <option value="">Select a project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>
      </div>

      {!selectedProject && (
        <div className="text-center py-10 text-neutral-500">Select a project to build custom tables.</div>
      )}

      {selectedProject && (
        <>
          <div className="card p-5">
            <form onSubmit={createTable} className="flex gap-2">
              <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wider mb-3">Create table</h3>
              <input
                className="input flex-1"
                value={newTableTitle}
                onChange={(e) => setNewTableTitle(e.target.value)}
                placeholder="Table title (e.g. Stakeholder Tracker)"
              />
              <input
                className="input flex-1"
                value={newTableDesc}
                onChange={(e) => setNewTableDesc(e.target.value)}
                placeholder="Description"
              />
              <button type="submit" className="btn-primary px-4" disabled={creatingTable}>
                {creatingTable ? 'Creating…' : <Plus className="w-4 h-4" />}
              </button>
            </form>
          </div>

          {tables.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tables.map((table) => (
                <div key={table.id} className="card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-neutral-900">{table.title}</h3>
                      <p className="text-xs text-neutral-500">{table.description ?? 'No description'}</p>
                    </div>
                    <button
                      onClick={() => deleteTable(table.id)}
                      className="p-1 text-red-400 hover:text-red-600"
                      title="Delete table"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-neutral-500 uppercase">Columns</span>
                      <button
                        onClick={() => { setEditingRow(table); setRowData({}); }}
                        className="p-1 text-brand-600 hover:text-brand-700"
                        title="Add column"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    {columns.length === 0 ? (
                      <div className="text-xs text-neutral-400 text-center py-2">No columns yet. Add one below.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="text-left border-b border-neutral-200 text-neutral-500 text-[10px] uppercase">
                              <th className="pb-2">Name</th>
                              <th className="pb-2">Type</th>
                              <th className="pb-2">Required</th>
                              <th className="pb-2 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {columns.map((col) => (
                              <tr key={col.id} className="border-b border-neutral-100">
                                <td className="py-1.5 text-neutral-700">{col.name}</td>
                                <td className="py-1.5 text-neutral-600 text-[10px] capitalize">{col.column_type.replace('_', ' ')}</td>
                                <td className="py-1.5 text-neutral-600 text-[10px]">{col.is_required ? 'Yes' : 'No'}</td>
                                <td className="py-1.5 text-right">
                                  <button
                                    onClick={() => deleteColumn(col.id, table.id)}
                                    className="text-[10px] text-red-500 hover:text-red-700"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {editingRow && editingRow.id === table.id && (
                    <div className="border-t border-neutral-200 pt-4 mb-4">
                      <form onSubmit={createColumn} className="space-y-2">
                        <h4 className="text-xs font-semibold text-neutral-700 mb-2">Add column</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <div className="col-span-1 sm:col-span-1">
                            <input className="input text-[11px]" value={newColName} onChange={(e) => setNewColName(e.target.value)} placeholder="Column name" />
                          </div>
                          <div className="col-span-1 sm:col-span-1">
                            <select className="input text-[11px]" value={newColType} onChange={(e) => setNewColType(e.target.value as ColumnType)}>
                              {COLUMN_TYPES.map((ct) => (
                                <option key={ct.value} value={ct.value}>{ct.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-1 sm:col-span-1">
                            <input className="input text-[11px]" value={newColOptions} onChange={(e) => setNewColOptions(e.target.value)} placeholder="Opt1, Opt2" />
                          </div>
                          <div className="col-span-1 sm:col-span-1 flex items-end">
                            <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                              <input type="checkbox" checked={newColRequired} onChange={(e) => setNewColRequired(e.target.checked)} /> Required
                            </label>
                          </div>
                        </div>
                        <div className="mt-2 text-[10px] text-neutral-500">Options are comma-separated values (for dropdown/status types).</div>
                        <button type="submit" className="btn-primary px-3 py-1.5 text-xs" disabled={creatingColumn}>
                          {creatingColumn ? 'Adding…' : <Save className="w-3 h-3 mr-1" />}
                        </button>
                      </form>
                    </div>
                  )}

                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-neutral-500 uppercase">Rows</span>
                      <button
                        onClick={() => { setEditingRow({ ...table, table_id: table.id }); setRowData({}); }}
                        className="p-1 text-brand-600 hover:text-brand-700"
                        title="Add row"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    {columns.length === 0 ? (
                      <div className="text-xs text-neutral-400 text-center py-4">Add columns first, then rows.</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="text-left border-b border-neutral-200 text-neutral-500 text-[10px] uppercase">
                              {columns.map((col) => (
                                <th key={col.id} className="pb-2">{col.name}</th>
                              ))}
                              <th className="pb-2 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row) => {
                              const isEditing = editingRow && editingRow.id === row.id
                              return (
                                <tr key={row.id} className="border-b border-neutral-100">
                                  {columns.map((col) => (
                                    <td key={col.id} className="py-2">
                                      {isEditing ? (
                                        <input
                                          className="input w-full text-[11px] border"
                                          value={cellValue(row, col)}
                                          onChange={(e) => handleCellChange(row, col, e.target.value)}
                                        />
                                      ) : (
                                        <span className="text-neutral-700 text-[11px] break-all">{cellValue(row, col) || '—'}</span>
                                      )}
                                    </td>
                                  ))}
                                  <td className="py-2 text-right">
                                    {isEditing && (
                                      <>
                                        <button onClick={() => updateRow()} className="text-[10px] text-green-600 hover:text-green-700 mr-1">Save</button>
                                        <button onClick={() => setEditingRow(null)} className="text-[10px] text-neutral-500 hover:text-neutral-700">Cancel</button>
                                      </>
                                    )}
                                    {!isEditing && (
                                      <>
                                        <button onClick={() => { setEditingRow(row); setRowData({ ...row.data }); }} className="text-[10px] text-brand-600 hover:text-brand-700 mr-1">Edit</button>
                                        <button onClick={() => deleteRow(row.id, table.id)} className="text-[10px] text-red-500 hover:text-red-700">Delete</button>
                                      </>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                            {editingRow && !editingRow.table_id && (
                              <tr>
                                {columns.map((col) => (
                                  <td key={col.id} className="py-2">
                                    <input
                                      className="input w-full text-[11px] border"
                                      value={rowData[col.name] ?? ''}
                                      onChange={(e) => setRowData({ ...rowData, [col.name]: e.target.value })}
                                    />
                                  </td>
                                ))}
                                <td className="py-2 text-right">
                                  <button onClick={createRow} className="text-[10px] text-green-600 hover:text-green-700 mr-1">Add</button>
                                  <button onClick={() => setEditingRow(null)} className="text-[10px] text-neutral-500 hover:text-neutral-700">Cancel</button>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {columns.length > 0 && !editingRow && (
                      <p className="text-xs text-neutral-500 mt-2">Click Edit on a row or the "+" button above to add a row.</p>
                    )}
                  </div>

                  {columns.length === 0 && tables.indexOf(table) === 0 && (
                    <div className="mt-2">
                      <button
                        onClick={() => { setEditingRow(table); loadColumns(table.id); loadRows(table.id); }}
                        className="text-xs text-brand-600 hover:text-brand-700"
                      >
                        Load columns and rows
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
