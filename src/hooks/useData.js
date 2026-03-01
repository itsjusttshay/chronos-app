import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../contexts/AuthContext'

// ── useClients ────────────────────────────────────────────
export function useClients() {
  const { user } = useAuth()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) setError(error.message)
    else setClients(data.map(normalizeClient))
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  async function addClient(client) {
    const { data, error } = await supabase
      .from('clients')
      .insert([{ ...denormalizeClient(client), user_id: user.id }])
      .select()
      .single()
    if (error) throw error
    setClients(cs => [...cs, normalizeClient(data)])
    return normalizeClient(data)
  }

  async function updateClient(id, updates) {
    const { data, error } = await supabase
      .from('clients')
      .update(denormalizeClient(updates))
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setClients(cs => cs.map(c => c.id === id ? normalizeClient(data) : c))
  }

  async function deleteClient(id) {
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) throw error
    setClients(cs => cs.filter(c => c.id !== id))
  }

  async function bulkAddClients(clientsArray) {
    const rows = clientsArray.map(c => ({ ...denormalizeClient(c), user_id: user.id }))
    const { data, error } = await supabase.from('clients').insert(rows).select()
    if (error) throw error
    const normalized = data.map(normalizeClient)
    setClients(cs => [...cs, ...normalized])
    return normalized
  }

  return { clients, loading, error, addClient, updateClient, deleteClient, bulkAddClients, refetch: fetch }
}

// ── useBlocks ─────────────────────────────────────────────
export function useBlocks() {
  const { user } = useAuth()
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('blocks')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) setError(error.message)
    else setBlocks(data.map(normalizeBlock))
    setLoading(false)
  }, [user])

  useEffect(() => { fetch() }, [fetch])

  async function addBlock(block) {
    const { data, error } = await supabase
      .from('blocks')
      .insert([{ ...denormalizeBlock(block), user_id: user.id }])
      .select()
      .single()
    if (error) throw error
    setBlocks(bs => [...bs, normalizeBlock(data)])
    return normalizeBlock(data)
  }

  async function updateBlock(id, updates) {
    const { data, error } = await supabase
      .from('blocks')
      .update(denormalizeBlock(updates))
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setBlocks(bs => bs.map(b => b.id === id ? normalizeBlock(data) : b))
  }

  async function deleteBlock(id) {
    const { error } = await supabase.from('blocks').delete().eq('id', id)
    if (error) throw error
    setBlocks(bs => bs.filter(b => b.id !== id))
  }

  return { blocks, loading, error, addBlock, updateBlock, deleteBlock, refetch: fetch }
}

// ── Normalizers (DB → app) ────────────────────────────────
function normalizeClient(row) {
  return {
    id:      row.id,
    name:    row.name,
    contact: row.contact || '',
    rate:    Number(row.rate) || 0,
    notes:   row.notes || '',
    color:   row.color || '#FF6B6B',
    year:    row.year,
  }
}

function normalizeBlock(row) {
  return {
    id:       row.id,
    clientId: row.client_id,
    day:      row.day,
    start:    row.start_hour,
    end:      row.end_hour,
    task:     row.task,
    recur:    row.recur || 'none',
  }
}

// ── Denormalizers (app → DB) ──────────────────────────────
function denormalizeClient(c) {
  return {
    name:    c.name,
    contact: c.contact,
    rate:    c.rate,
    notes:   c.notes,
    color:   c.color,
    year:    c.year,
  }
}

function denormalizeBlock(b) {
  return {
    client_id:  b.clientId,
    day:        b.day,
    start_hour: b.start,
    end_hour:   b.end,
    task:       b.task,
    recur:      b.recur,
  }
}
