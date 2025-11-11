import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, DollarSign, Target, Trophy, XCircle, Clock, Lock, LogOut, Plus, Edit, Trash2 } from 'lucide-react'
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

const STORED_PASSWORD_HASH = '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'

interface Match {
  id?: number
  home_team: string
  away_team: string
  home_score?: number | null
  away_score?: number | null
  match_date: string
  status: string
  league: string
}

interface BetSelection {
  id?: number
  bet_id?: number
  match_id: number
  bet_type: string
  odds: number
  status: string
  created_at?: string
}

interface Bet {
  id?: number
  match_id?: number | null
  bet_type?: string | null
  odds: number
  stake: number
  status: string
  potential_return?: number
  actual_return?: number | null
  notes?: string
  is_composite?: boolean
  selections?: BetSelection[]
  created_at?: string
}

interface Statistics {
  total_bets: number
  total_stake: number
  total_return: number
  profit_loss: number
  won_bets: number
  lost_bets: number
  pending_bets: number
  win_rate: number
  roi: number
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [matches, setMatches] = useState<Match[]>([])
  const [bets, setBets] = useState<Bet[]>([])
  const [statistics, setStatistics] = useState<Statistics | null>(null)
  const [isMatchDialogOpen, setIsMatchDialogOpen] = useState(false)
  const [isBetDialogOpen, setIsBetDialogOpen] = useState(false)
  const [isCompositeBetDialogOpen, setIsCompositeBetDialogOpen] = useState(false)
  const [isEditMatchDialogOpen, setIsEditMatchDialogOpen] = useState(false)
  const [isEditBetDialogOpen, setIsEditBetDialogOpen] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [selectedBet, setSelectedBet] = useState<Bet | null>(null)
  const [compositeBetSelections, setCompositeBetSelections] = useState<BetSelection[]>([])
  const [compositeBetStake, setCompositeBetStake] = useState(0)
  const [compositeBetNotes, setCompositeBetNotes] = useState('')

  const [newMatch, setNewMatch] = useState<Match>({
    home_team: '',
    away_team: '',
    match_date: '',
    status: 'scheduled',
    league: ''
  })

  const [newBet, setNewBet] = useState<Bet>({
    match_id: 0,
    bet_type: 'home_win',
    odds: 0,
    stake: 0,
    status: 'pending'
  })

  useEffect(() => {
    fetch(`${API_URL}/healthz`).catch(() => {})
    
    const authStatus = sessionStorage.getItem('authenticated')
    if (authStatus === 'true') {
      setIsAuthenticated(true)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) return
    
    setIsLoading(true)
    Promise.all([
      fetchMatches(),
      fetchBets(),
      fetchStatistics()
    ]).finally(() => {
      setIsLoading(false)
    })
  }, [isAuthenticated])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginError('')
    
    const hashedInput = await hashPassword(loginPassword)
    
    if (hashedInput === STORED_PASSWORD_HASH) {
      setIsAuthenticated(true)
      sessionStorage.setItem('authenticated', 'true')
      setLoginPassword('')
    } else {
      setLoginError('Senha incorreta. Tente novamente.')
      setLoginPassword('')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    sessionStorage.removeItem('authenticated')
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white shadow-2xl border-0 animate-in fade-in duration-500">
          <CardHeader className="space-y-1 text-center pb-8">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-300">
                <Lock className="w-10 h-10 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Sistema de Apostas
            </CardTitle>
            <CardDescription className="text-gray-600 text-base">
              Digite sua senha para acessar o sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 font-medium">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="h-12 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              {loginError && (
                <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg p-3 animate-in slide-in-from-top duration-300">
                  {loginError}
                </div>
              )}
              <Button type="submit" className="w-full h-12 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300">
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  const fetchMatches = async () => {
    try {
      const response = await fetch(`${API_URL}/matches`)
      const data = await response.json()
      setMatches(data)
    } catch (error) {
      console.error('Error fetching matches:', error)
    }
  }

  const fetchBets = async () => {
    try {
      const response = await fetch(`${API_URL}/bets`)
      const data = await response.json()
      setBets(data)
    } catch (error) {
      console.error('Error fetching bets:', error)
    }
  }

  const fetchStatistics = async () => {
    try {
      const response = await fetch(`${API_URL}/statistics`)
      const data = await response.json()
      setStatistics(data)
    } catch (error) {
      console.error('Error fetching statistics:', error)
    }
  }

  const createMatch = async () => {
    try {
      const response = await fetch(`${API_URL}/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMatch)
      })
      if (response.ok) {
        fetchMatches()
        setIsMatchDialogOpen(false)
        setNewMatch({ home_team: '', away_team: '', match_date: '', status: 'scheduled', league: '' })
      }
    } catch (error) {
      console.error('Error creating match:', error)
    }
  }

  const updateMatch = async () => {
    if (!selectedMatch || !selectedMatch.id) return
    try {
      const response = await fetch(`${API_URL}/matches/${selectedMatch.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedMatch)
      })
      if (response.ok) {
        fetchMatches()
        setIsEditMatchDialogOpen(false)
        setSelectedMatch(null)
      }
    } catch (error) {
      console.error('Error updating match:', error)
    }
  }

  const deleteMatch = async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/matches/${id}`, { method: 'DELETE' })
      if (response.ok) {
        fetchMatches()
      }
    } catch (error) {
      console.error('Error deleting match:', error)
    }
  }

  const createBet = async () => {
    try {
      const response = await fetch(`${API_URL}/bets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBet)
      })
      if (response.ok) {
        fetchBets()
        fetchStatistics()
        setIsBetDialogOpen(false)
        setNewBet({ match_id: 0, bet_type: 'home_win', odds: 0, stake: 0, status: 'pending' })
      }
    } catch (error) {
      console.error('Error creating bet:', error)
    }
  }

  const createCompositeBet = async () => {
    if (compositeBetSelections.length < 2) {
      alert('Aposta composta deve ter pelo menos 2 seleções')
      return
    }
    try {
      const response = await fetch(`${API_URL}/bets/composite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stake: compositeBetStake,
          notes: compositeBetNotes,
          selections: compositeBetSelections
        })
      })
      if (response.ok) {
        fetchBets()
        fetchStatistics()
        setIsCompositeBetDialogOpen(false)
        setCompositeBetSelections([])
        setCompositeBetStake(0)
        setCompositeBetNotes('')
      }
    } catch (error) {
      console.error('Error creating composite bet:', error)
    }
  }

  const addSelectionToCompositeBet = (matchId: number, betType: string, odds: number) => {
    setCompositeBetSelections([...compositeBetSelections, {
      match_id: matchId,
      bet_type: betType,
      odds: odds,
      status: 'pending'
    }])
  }

  const removeSelectionFromCompositeBet = (index: number) => {
    setCompositeBetSelections(compositeBetSelections.filter((_, i) => i !== index))
  }

  const calculateCombinedOdds = () => {
    if (compositeBetSelections.length === 0) return 0
    return compositeBetSelections.reduce((acc, sel) => acc * sel.odds, 1)
  }

  const updateBet = async () => {
    if (!selectedBet || !selectedBet.id) return
    try {
      const response = await fetch(`${API_URL}/bets/${selectedBet.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedBet)
      })
      if (response.ok) {
        fetchBets()
        fetchStatistics()
        setIsEditBetDialogOpen(false)
        setSelectedBet(null)
      }
    } catch (error) {
      console.error('Error updating bet:', error)
    }
  }

  const deleteBet = async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/bets/${id}`, { method: 'DELETE' })
      if (response.ok) {
        fetchBets()
        fetchStatistics()
      }
    } catch (error) {
      console.error('Error deleting bet:', error)
    }
  }

  const getMatchName = (matchId: number) => {
    const match = matches.find(m => m.id === matchId)
    return match ? `${match.home_team} vs ${match.away_team}` : 'Unknown Match'
  }

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-700 border-amber-200',
      won: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      lost: 'bg-rose-100 text-rose-700 border-rose-200',
      void: 'bg-gray-100 text-gray-700 border-gray-200',
      scheduled: 'bg-blue-100 text-blue-700 border-blue-200',
      live: 'bg-orange-100 text-orange-700 border-orange-200',
      finished: 'bg-purple-100 text-purple-700 border-purple-200',
      cancelled: 'bg-gray-100 text-gray-700 border-gray-200'
    }
    return <Badge className={`${colors[status] || 'bg-gray-100 text-gray-700'} border font-medium`}>{status.toUpperCase()}</Badge>
  }

  const betTypeLabels: Record<string, string> = {
    home_win: 'Vitória Casa',
    draw: 'Empate',
    away_win: 'Vitória Fora',
    over_goals: 'Mais Gols',
    under_goals: 'Menos Gols',
    both_score: 'Ambos Marcam'
  }

  const pieData = statistics ? [
    { name: 'Ganhas', value: statistics.won_bets, color: '#22c55e' },
    { name: 'Perdidas', value: statistics.lost_bets, color: '#ef4444' },
    { name: 'Pendentes', value: statistics.pending_bets, color: '#eab308' }
  ] : []

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <Card className="w-full max-w-md bg-white shadow-2xl border-0">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-center">
                <p className="text-xl font-semibold text-gray-900">Carregando dados...</p>
                <p className="text-sm text-gray-600 mt-2">Aguarde enquanto conectamos ao servidor</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-8 flex items-center justify-between bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
              Sistema de Apostas Esportivas
            </h1>
            <p className="text-gray-600 text-lg">Controle completo das suas apostas de futebol</p>
          </div>
          <Button 
            onClick={handleLogout}
            variant="outline"
            className="h-12 px-6 border-2 border-gray-200 hover:border-red-300 hover:bg-red-50 hover:text-red-600 transition-all duration-300 font-medium"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Sair
          </Button>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white p-2 rounded-xl shadow-md border border-gray-100 h-14">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white rounded-lg font-medium transition-all duration-300">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="matches" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white rounded-lg font-medium transition-all duration-300">
              Partidas
            </TabsTrigger>
            <TabsTrigger value="bets" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white rounded-lg font-medium transition-all duration-300">
              Apostas
            </TabsTrigger>
            <TabsTrigger value="statistics" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-indigo-500 data-[state=active]:text-white rounded-lg font-medium transition-all duration-300">
              Estatísticas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6 animate-in fade-in duration-500">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-600">Total Apostado</CardTitle>
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">R$ {statistics?.total_stake.toFixed(2) || '0.00'}</div>
                  <p className="text-xs text-gray-500 mt-1">Valor total investido</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-600">Lucro/Prejuízo</CardTitle>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${statistics && statistics.profit_loss >= 0 ? 'bg-gradient-to-br from-emerald-500 to-green-500' : 'bg-gradient-to-br from-rose-500 to-red-500'}`}>
                    {statistics && statistics.profit_loss >= 0 ? (
                      <TrendingUp className="h-5 w-5 text-white" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-white" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${statistics && statistics.profit_loss >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    R$ {statistics?.profit_loss.toFixed(2) || '0.00'}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Resultado líquido</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-600">Taxa de Acerto</CardTitle>
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <Target className="h-5 w-5 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{statistics?.win_rate.toFixed(1) || '0.0'}%</div>
                  <p className="text-xs text-gray-500 mt-1">Apostas vencedoras</p>
                </CardContent>
              </Card>

              <Card className="bg-white border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-semibold text-gray-600">ROI</CardTitle>
                  <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
                    <Trophy className="h-5 w-5 text-white" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-900">{statistics?.roi.toFixed(1) || '0.0'}%</div>
                  <p className="text-xs text-gray-500 mt-1">Retorno sobre investimento</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="bg-white border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-gray-900">Distribuição de Apostas</CardTitle>
                  <CardDescription className="text-gray-600">Visualização por status</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="bg-white border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-gray-900">Resumo Detalhado</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                        <Target className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Total de Apostas</p>
                        <p className="text-2xl font-bold text-gray-900">{statistics?.total_bets || 0}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl border border-emerald-100">
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-500 rounded-lg flex items-center justify-center">
                        <Trophy className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Apostas Ganhas</p>
                        <p className="text-2xl font-bold text-emerald-600">{statistics?.won_bets || 0}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-rose-50 to-red-50 rounded-xl border border-rose-100">
                      <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-red-500 rounded-lg flex items-center justify-center">
                        <XCircle className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Apostas Perdidas</p>
                        <p className="text-2xl font-bold text-rose-600">{statistics?.lost_bets || 0}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-100">
                      <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
                        <Clock className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Apostas Pendentes</p>
                        <p className="text-2xl font-bold text-amber-600">{statistics?.pending_bets || 0}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="matches" className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Gerenciar Partidas</h2>
              <Dialog open={isMatchDialogOpen} onOpenChange={setIsMatchDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-300 h-11 px-6 font-semibold">
                    <Plus className="w-5 h-5 mr-2" />
                    Nova Partida
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white border-0 shadow-2xl max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-gray-900">Criar Nova Partida</DialogTitle>
                    <DialogDescription className="text-gray-600">
                      Adicione uma nova partida ao sistema
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="home_team" className="text-gray-700 font-medium">Time Casa</Label>
                      <Input
                        id="home_team"
                        value={newMatch.home_team}
                        onChange={(e) => setNewMatch({ ...newMatch, home_team: e.target.value })}
                        className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="away_team" className="text-gray-700 font-medium">Time Fora</Label>
                      <Input
                        id="away_team"
                        value={newMatch.away_team}
                        onChange={(e) => setNewMatch({ ...newMatch, away_team: e.target.value })}
                        className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="league" className="text-gray-700 font-medium">Liga</Label>
                      <Input
                        id="league"
                        value={newMatch.league}
                        onChange={(e) => setNewMatch({ ...newMatch, league: e.target.value })}
                        className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="match_date" className="text-gray-700 font-medium">Data/Hora</Label>
                      <Input
                        id="match_date"
                        type="datetime-local"
                        value={newMatch.match_date}
                        onChange={(e) => setNewMatch({ ...newMatch, match_date: e.target.value })}
                        className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={createMatch} className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-semibold">
                      Criar Partida
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="bg-white border-0 shadow-lg overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                        <TableHead className="text-gray-700 font-semibold">Time Casa</TableHead>
                        <TableHead className="text-gray-700 font-semibold">Time Fora</TableHead>
                        <TableHead className="text-gray-700 font-semibold">Placar</TableHead>
                        <TableHead className="text-gray-700 font-semibold">Liga</TableHead>
                        <TableHead className="text-gray-700 font-semibold">Data</TableHead>
                        <TableHead className="text-gray-700 font-semibold">Status</TableHead>
                        <TableHead className="text-gray-700 font-semibold">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {matches.map((match) => (
                        <TableRow key={match.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200">
                          <TableCell className="text-gray-900 font-medium">{match.home_team}</TableCell>
                          <TableCell className="text-gray-900 font-medium">{match.away_team}</TableCell>
                          <TableCell className="text-gray-900 font-bold">
                            {match.home_score !== null && match.away_score !== null
                              ? `${match.home_score} - ${match.away_score}`
                              : '-'}
                          </TableCell>
                          <TableCell className="text-gray-700">{match.league}</TableCell>
                          <TableCell className="text-gray-700">
                            {new Date(match.match_date).toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell>{getStatusBadge(match.status)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedMatch(match)
                                  setIsEditMatchDialogOpen(true)
                                }}
                                className="h-9 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200"
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => match.id && deleteMatch(match.id)}
                                className="h-9 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-all duration-200"
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Excluir
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Dialog open={isEditMatchDialogOpen} onOpenChange={setIsEditMatchDialogOpen}>
              <DialogContent className="bg-white border-0 shadow-2xl max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-gray-900">Editar Partida</DialogTitle>
                </DialogHeader>
                {selectedMatch && (
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit_home_team" className="text-gray-700 font-medium">Time Casa</Label>
                      <Input
                        id="edit_home_team"
                        value={selectedMatch.home_team}
                        onChange={(e) => setSelectedMatch({ ...selectedMatch, home_team: e.target.value })}
                        className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit_away_team" className="text-gray-700 font-medium">Time Fora</Label>
                      <Input
                        id="edit_away_team"
                        value={selectedMatch.away_team}
                        onChange={(e) => setSelectedMatch({ ...selectedMatch, away_team: e.target.value })}
                        className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit_home_score" className="text-gray-700 font-medium">Placar Casa</Label>
                      <Input
                        id="edit_home_score"
                        type="number"
                        value={selectedMatch.home_score ?? ''}
                        onChange={(e) => setSelectedMatch({ ...selectedMatch, home_score: e.target.value ? parseInt(e.target.value) : null })}
                        className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit_away_score" className="text-gray-700 font-medium">Placar Fora</Label>
                      <Input
                        id="edit_away_score"
                        type="number"
                        value={selectedMatch.away_score ?? ''}
                        onChange={(e) => setSelectedMatch({ ...selectedMatch, away_score: e.target.value ? parseInt(e.target.value) : null })}
                        className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit_status" className="text-gray-700 font-medium">Status</Label>
                      <Select value={selectedMatch.status} onValueChange={(value) => setSelectedMatch({ ...selectedMatch, status: value })}>
                        <SelectTrigger className="h-11 border-gray-300 focus:border-blue-500 focus:ring-blue-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-gray-200">
                          <SelectItem value="scheduled">Agendada</SelectItem>
                          <SelectItem value="live">Ao Vivo</SelectItem>
                          <SelectItem value="finished">Finalizada</SelectItem>
                          <SelectItem value="cancelled">Cancelada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button onClick={updateMatch} className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 font-semibold">
                    Salvar Alterações
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="bets" className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Gerenciar Apostas</h2>
              <div className="flex gap-3">
                <Dialog open={isBetDialogOpen} onOpenChange={setIsBetDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 shadow-lg hover:shadow-xl transition-all duration-300 h-11 px-6 font-semibold">
                      <Plus className="w-5 h-5 mr-2" />
                      Nova Aposta
                    </Button>
                  </DialogTrigger>
                <DialogContent className="bg-white border-0 shadow-2xl max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-gray-900">Criar Nova Aposta</DialogTitle>
                    <DialogDescription className="text-gray-600">
                      Adicione uma nova aposta ao sistema
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="match_id" className="text-gray-700 font-medium">Partida</Label>
                      <Select value={newBet.match_id?.toString() || ''} onValueChange={(value) => setNewBet({ ...newBet, match_id: parseInt(value) })}>
                        <SelectTrigger className="h-11 border-gray-300 focus:border-emerald-500 focus:ring-emerald-500">
                          <SelectValue placeholder="Selecione uma partida" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-gray-200">
                          {matches.map((match) => (
                            <SelectItem key={match.id} value={match.id!.toString()}>
                              {match.home_team} vs {match.away_team}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="bet_type" className="text-gray-700 font-medium">Tipo de Aposta</Label>
                      <Select value={newBet.bet_type || ''} onValueChange={(value) => setNewBet({ ...newBet, bet_type: value })}>
                        <SelectTrigger className="h-11 border-gray-300 focus:border-emerald-500 focus:ring-emerald-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-gray-200">
                          <SelectItem value="home_win">Vitória Casa</SelectItem>
                          <SelectItem value="draw">Empate</SelectItem>
                          <SelectItem value="away_win">Vitória Fora</SelectItem>
                          <SelectItem value="over_goals">Mais Gols</SelectItem>
                          <SelectItem value="under_goals">Menos Gols</SelectItem>
                          <SelectItem value="both_score">Ambos Marcam</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="odds" className="text-gray-700 font-medium">Odds</Label>
                      <Input
                        id="odds"
                        type="number"
                        step="0.01"
                        value={newBet.odds}
                        onChange={(e) => setNewBet({ ...newBet, odds: parseFloat(e.target.value) })}
                        className="h-11 border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="stake" className="text-gray-700 font-medium">Valor Apostado (R$)</Label>
                      <Input
                        id="stake"
                        type="number"
                        step="0.01"
                        value={newBet.stake}
                        onChange={(e) => setNewBet({ ...newBet, stake: parseFloat(e.target.value) })}
                        className="h-11 border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={createBet} className="w-full h-11 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 font-semibold">
                      Criar Aposta
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              
              <Dialog open={isCompositeBetDialogOpen} onOpenChange={setIsCompositeBetDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transition-all duration-300 h-11 px-6 font-semibold">
                    <Plus className="w-5 h-5 mr-2" />
                    Aposta Composta
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-white border-0 shadow-2xl max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-gray-900">Criar Aposta Composta</DialogTitle>
                    <DialogDescription className="text-gray-600">
                      Combine múltiplas partidas. Todas devem ganhar para receber o retorno.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label className="text-gray-700 font-medium">Adicionar Partidas</Label>
                      <div className="text-xs text-gray-600 mb-2">Selecione pelo menos 2 partidas para criar uma aposta composta</div>
                      <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-2">
                        {matches.map((match) => (
                          <div key={match.id} className="p-3 bg-white rounded-lg border border-gray-200 hover:border-purple-300 transition-colors">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium text-gray-900">{match.home_team} vs {match.away_team}</p>
                              <Badge className="bg-blue-100 text-blue-700 text-xs">{match.league}</Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addSelectionToCompositeBet(match.id!, 'home_win', 1.8)}
                                className="h-8 text-xs border-gray-300 hover:bg-purple-50 hover:border-purple-300"
                              >
                                Casa 1.8
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addSelectionToCompositeBet(match.id!, 'draw', 3.2)}
                                className="h-8 text-xs border-gray-300 hover:bg-purple-50 hover:border-purple-300"
                              >
                                Empate 3.2
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addSelectionToCompositeBet(match.id!, 'away_win', 2.1)}
                                className="h-8 text-xs border-gray-300 hover:bg-purple-50 hover:border-purple-300"
                              >
                                Fora 2.1
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {compositeBetSelections.length > 0 && (
                      <>
                        <div className="grid gap-2">
                          <Label className="text-gray-700 font-medium">Seleções Adicionadas ({compositeBetSelections.length})</Label>
                          <div className="space-y-2">
                            {compositeBetSelections.map((selection, index) => (
                              <div key={index} className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900">{getMatchName(selection.match_id)}</p>
                                  <p className="text-xs text-gray-600">{betTypeLabels[selection.bet_type]} - Odds: {selection.odds.toFixed(2)}</p>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => removeSelectionFromCompositeBet(index)}
                                  className="h-8 border-red-200 text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="p-4 bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg border-2 border-purple-300">
                          <p className="text-sm font-medium text-gray-700 mb-2">Odds Combinadas (Multiplicadas)</p>
                          <p className="text-4xl font-bold text-purple-700">{calculateCombinedOdds().toFixed(2)}</p>
                          {compositeBetStake > 0 && (
                            <p className="text-sm text-gray-700 mt-2">
                              Retorno Potencial: <span className="font-bold text-emerald-700">R$ {(compositeBetStake * calculateCombinedOdds()).toFixed(2)}</span>
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    <div className="grid gap-2">
                      <Label htmlFor="composite_stake" className="text-gray-700 font-medium">Valor Apostado (R$)</Label>
                      <Input
                        id="composite_stake"
                        type="number"
                        step="0.01"
                        value={compositeBetStake}
                        onChange={(e) => setCompositeBetStake(parseFloat(e.target.value) || 0)}
                        className="h-11 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                        placeholder="Digite o valor da aposta"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="composite_notes" className="text-gray-700 font-medium">Notas (opcional)</Label>
                      <Input
                        id="composite_notes"
                        value={compositeBetNotes}
                        onChange={(e) => setCompositeBetNotes(e.target.value)}
                        className="h-11 border-gray-300 focus:border-purple-500 focus:ring-purple-500"
                        placeholder="Adicione observações sobre esta aposta"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button 
                      onClick={createCompositeBet} 
                      disabled={compositeBetSelections.length < 2}
                      className="w-full h-11 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 font-semibold disabled:opacity-50"
                    >
                      Criar Aposta Composta ({compositeBetSelections.length} seleções)
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              </div>
            </div>

            <Card className="bg-white border-0 shadow-lg overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                        <TableHead className="text-gray-700 font-semibold">Partida(s)</TableHead>
                        <TableHead className="text-gray-700 font-semibold">Tipo</TableHead>
                        <TableHead className="text-gray-700 font-semibold">Odds</TableHead>
                        <TableHead className="text-gray-700 font-semibold">Valor</TableHead>
                        <TableHead className="text-gray-700 font-semibold">Retorno Potencial</TableHead>
                        <TableHead className="text-gray-700 font-semibold">Status</TableHead>
                        <TableHead className="text-gray-700 font-semibold">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bets.map((bet) => (
                        <TableRow key={bet.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors duration-200">
                          <TableCell className="text-gray-900 font-medium">
                            {bet.is_composite ? (
                              <div>
                                <Badge className="bg-purple-100 text-purple-700 border-purple-200 mb-1">COMPOSTA</Badge>
                                <div className="text-xs text-gray-600">
                                  {bet.selections?.map((sel, idx) => (
                                    <div key={idx}>{getMatchName(sel.match_id)}</div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              getMatchName(bet.match_id!)
                            )}
                          </TableCell>
                          <TableCell className="text-gray-700">
                            {bet.is_composite ? (
                              <div className="text-xs">
                                {bet.selections?.map((sel, idx) => (
                                  <div key={idx}>{betTypeLabels[sel.bet_type]}</div>
                                ))}
                              </div>
                            ) : (
                              betTypeLabels[bet.bet_type!]
                            )}
                          </TableCell>
                          <TableCell className="text-gray-900 font-bold">{bet.odds.toFixed(2)}</TableCell>
                          <TableCell className="text-gray-900 font-medium">R$ {bet.stake.toFixed(2)}</TableCell>
                          <TableCell className="text-emerald-600 font-bold">R$ {bet.potential_return?.toFixed(2) || '0.00'}</TableCell>
                          <TableCell>{getStatusBadge(bet.status)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedBet(bet)
                                  setIsEditBetDialogOpen(true)
                                }}
                                className="h-9 border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 transition-all duration-200"
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => bet.id && deleteBet(bet.id)}
                                className="h-9 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-all duration-200"
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                Excluir
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Dialog open={isEditBetDialogOpen} onOpenChange={setIsEditBetDialogOpen}>
              <DialogContent className="bg-white border-0 shadow-2xl max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold text-gray-900">Editar Aposta</DialogTitle>
                </DialogHeader>
                {selectedBet && (
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit_bet_status" className="text-gray-700 font-medium">Status</Label>
                      <Select value={selectedBet.status} onValueChange={(value) => setSelectedBet({ ...selectedBet, status: value })}>
                        <SelectTrigger className="h-11 border-gray-300 focus:border-emerald-500 focus:ring-emerald-500">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-gray-200">
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="won">Ganha</SelectItem>
                          <SelectItem value="lost">Perdida</SelectItem>
                          <SelectItem value="void">Anulada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit_notes" className="text-gray-700 font-medium">Notas</Label>
                      <Input
                        id="edit_notes"
                        value={selectedBet.notes || ''}
                        onChange={(e) => setSelectedBet({ ...selectedBet, notes: e.target.value })}
                        className="h-11 border-gray-300 focus:border-emerald-500 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button onClick={updateBet} className="w-full h-11 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 font-semibold">
                    Salvar Alterações
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="statistics" className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-2xl font-bold text-gray-900">Estatísticas Detalhadas</h2>
            
            <div className="grid gap-6 md:grid-cols-3">
              <Card className="bg-white border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                      <Target className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Total de Apostas</p>
                      <p className="text-3xl font-bold text-gray-900">{statistics?.total_bets || 0}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Total Investido</p>
                      <p className="text-3xl font-bold text-gray-900">R$ {statistics?.total_stake.toFixed(2) || '0.00'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-0 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-500 rounded-lg flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Total Retornado</p>
                      <p className="text-3xl font-bold text-gray-900">R$ {statistics?.total_return.toFixed(2) || '0.00'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="bg-white border-0 shadow-lg">
                <CardContent className="p-6">
                  <p className="text-sm text-gray-600 font-medium mb-3">Lucro/Prejuízo</p>
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${statistics && statistics.profit_loss >= 0 ? 'bg-gradient-to-br from-emerald-500 to-green-500' : 'bg-gradient-to-br from-rose-500 to-red-500'}`}>
                      {statistics && statistics.profit_loss >= 0 ? (
                        <TrendingUp className="w-6 h-6 text-white" />
                      ) : (
                        <TrendingDown className="w-6 h-6 text-white" />
                      )}
                    </div>
                    <p className={`text-4xl font-bold ${statistics && statistics.profit_loss >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      R$ {statistics?.profit_loss.toFixed(2) || '0.00'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-white border-0 shadow-lg">
                <CardContent className="p-6">
                  <p className="text-sm text-gray-600 font-medium mb-3">ROI (Retorno sobre Investimento)</p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
                      <Trophy className="w-6 h-6 text-white" />
                    </div>
                    <p className={`text-4xl font-bold ${statistics && statistics.roi >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {statistics?.roi.toFixed(2) || '0.00'}%
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white border-0 shadow-lg">
              <CardContent className="p-6">
                <p className="text-lg font-bold text-gray-900 mb-4">Taxa de Acerto</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="h-10 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-500"
                        style={{ width: `${statistics?.win_rate || 0}%` }}
                      ></div>
                    </div>
                  </div>
                  <span className="text-3xl font-bold text-gray-900">{statistics?.win_rate.toFixed(1) || '0.0'}%</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-0 shadow-lg">
              <CardContent className="p-6">
                <p className="text-lg font-bold text-gray-900 mb-4">Distribuição de Resultados</p>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl border border-emerald-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-500 rounded-lg flex items-center justify-center">
                        <Trophy className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-gray-700 font-medium">Apostas Ganhas</span>
                    </div>
                    <span className="text-2xl font-bold text-emerald-600">{statistics?.won_bets || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-rose-50 to-red-50 rounded-xl border border-rose-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-rose-500 to-red-500 rounded-lg flex items-center justify-center">
                        <XCircle className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-gray-700 font-medium">Apostas Perdidas</span>
                    </div>
                    <span className="text-2xl font-bold text-rose-600">{statistics?.lost_bets || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
                        <Clock className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-gray-700 font-medium">Apostas Pendentes</span>
                    </div>
                    <span className="text-2xl font-bold text-amber-600">{statistics?.pending_bets || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default App
