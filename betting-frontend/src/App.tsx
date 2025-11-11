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
import { TrendingUp, TrendingDown, DollarSign, Target, Trophy, XCircle, Clock, Lock, LogOut } from 'lucide-react'
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

interface Bet {
  id?: number
  match_id: number
  bet_type: string
  odds: number
  stake: number
  status: string
  potential_return?: number
  actual_return?: number | null
  notes?: string
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
  const [isEditMatchDialogOpen, setIsEditMatchDialogOpen] = useState(false)
  const [isEditBetDialogOpen, setIsEditBetDialogOpen] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [selectedBet, setSelectedBet] = useState<Bet | null>(null)

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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <Lock className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-white">Sistema de Apostas</CardTitle>
            <CardDescription className="text-slate-400">
              Digite sua senha para acessar o sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-200">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400"
                  autoFocus
                />
              </div>
              {loginError && (
                <div className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded p-2">
                  {loginError}
                </div>
              )}
              <Button type="submit" className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
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
      pending: 'bg-yellow-500',
      won: 'bg-green-500',
      lost: 'bg-red-500',
      void: 'bg-gray-500',
      scheduled: 'bg-blue-500',
      live: 'bg-orange-500',
      finished: 'bg-purple-500',
      cancelled: 'bg-gray-500'
    }
    return <Badge className={colors[status] || 'bg-gray-500'}>{status.toUpperCase()}</Badge>
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="w-full max-w-md bg-slate-800 border-slate-700">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-center">
                <p className="text-xl font-semibold text-white">Carregando dados...</p>
                <p className="text-sm text-slate-400 mt-2">Aguarde enquanto conectamos ao servidor</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto p-6">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-3 animate-pulse">
              Sistema de Apostas Esportivas
            </h1>
            <p className="text-slate-300 text-lg">⚽ Controle completo das suas apostas de futebol</p>
          </div>
          <Button 
            onClick={handleLogout}
            variant="outline"
            className="bg-gradient-to-r from-red-500/20 to-pink-500/20 border-red-500/30 text-red-200 hover:bg-red-500/30 hover:text-white hover:scale-105 transition-all duration-200 shadow-lg hover:shadow-red-500/50"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair
          </Button>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-gradient-to-r from-slate-800/80 to-slate-900/80 backdrop-blur-sm p-1 rounded-xl border border-slate-700/50 shadow-xl">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="matches" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200">
              Partidas
            </TabsTrigger>
            <TabsTrigger value="bets" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200">
              Apostas
            </TabsTrigger>
            <TabsTrigger value="statistics" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-lg transition-all duration-200">
              Estatísticas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20 backdrop-blur-sm hover:shadow-lg hover:shadow-blue-500/20 transition-all duration-300 hover:scale-105">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-blue-100">Total Apostado</CardTitle>
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <DollarSign className="h-5 w-5 text-blue-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                    R$ {statistics?.total_stake.toFixed(2) || '0.00'}
                  </div>
                </CardContent>
              </Card>

              <Card className={`${statistics && statistics.profit_loss >= 0 ? 'bg-gradient-to-br from-green-500/10 to-emerald-600/5 border-green-500/20 hover:shadow-green-500/20' : 'bg-gradient-to-br from-red-500/10 to-rose-600/5 border-red-500/20 hover:shadow-red-500/20'} backdrop-blur-sm hover:shadow-lg transition-all duration-300 hover:scale-105`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className={`text-sm font-medium ${statistics && statistics.profit_loss >= 0 ? 'text-green-100' : 'text-red-100'}`}>
                    Lucro/Prejuízo
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${statistics && statistics.profit_loss >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                    {statistics && statistics.profit_loss >= 0 ? (
                      <TrendingUp className="h-5 w-5 text-green-400" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-400" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${statistics && statistics.profit_loss >= 0 ? 'bg-gradient-to-r from-green-400 to-emerald-600 bg-clip-text text-transparent' : 'bg-gradient-to-r from-red-400 to-rose-600 bg-clip-text text-transparent'}`}>
                    R$ {statistics?.profit_loss.toFixed(2) || '0.00'}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20 backdrop-blur-sm hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300 hover:scale-105">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-purple-100">Taxa de Acerto</CardTitle>
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Target className="h-5 w-5 text-purple-400" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-purple-600 bg-clip-text text-transparent">
                    {statistics?.win_rate.toFixed(1) || '0.0'}%
                  </div>
                </CardContent>
              </Card>

              <Card className={`${statistics && statistics.roi >= 0 ? 'bg-gradient-to-br from-amber-500/10 to-yellow-600/5 border-amber-500/20 hover:shadow-amber-500/20' : 'bg-gradient-to-br from-orange-500/10 to-red-600/5 border-orange-500/20 hover:shadow-orange-500/20'} backdrop-blur-sm hover:shadow-lg transition-all duration-300 hover:scale-105`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className={`text-sm font-medium ${statistics && statistics.roi >= 0 ? 'text-amber-100' : 'text-orange-100'}`}>ROI</CardTitle>
                  <div className={`p-2 rounded-lg ${statistics && statistics.roi >= 0 ? 'bg-amber-500/20' : 'bg-orange-500/20'}`}>
                    <Trophy className={`h-5 w-5 ${statistics && statistics.roi >= 0 ? 'text-amber-400' : 'text-orange-400'}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${statistics && statistics.roi >= 0 ? 'bg-gradient-to-r from-amber-400 to-yellow-600 bg-clip-text text-transparent' : 'bg-gradient-to-r from-orange-400 to-red-600 bg-clip-text text-transparent'}`}>
                    {statistics?.roi.toFixed(1) || '0.0'}%
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 backdrop-blur-sm hover:shadow-xl hover:shadow-purple-500/10 transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Distribuição de Apostas
                  </CardTitle>
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
                        outerRadius={90}
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

              <Card className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700/50 backdrop-blur-sm hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300">
                <CardHeader>
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                    Resumo de Apostas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20 hover:bg-green-500/20 transition-all duration-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/20 rounded-lg">
                          <Trophy className="h-5 w-5 text-green-400" />
                        </div>
                        <span className="text-slate-200 font-medium">Apostas Ganhas</span>
                      </div>
                      <span className="text-2xl font-bold text-green-400">{statistics?.won_bets || 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-all duration-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-500/20 rounded-lg">
                          <XCircle className="h-5 w-5 text-red-400" />
                        </div>
                        <span className="text-slate-200 font-medium">Apostas Perdidas</span>
                      </div>
                      <span className="text-2xl font-bold text-red-400">{statistics?.lost_bets || 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20 transition-all duration-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-yellow-500/20 rounded-lg">
                          <Clock className="h-5 w-5 text-yellow-400" />
                        </div>
                        <span className="text-slate-200 font-medium">Apostas Pendentes</span>
                      </div>
                      <span className="text-2xl font-bold text-yellow-400">{statistics?.pending_bets || 0}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 mt-2">
                      <span className="text-slate-100 font-semibold text-lg">Total de Apostas</span>
                      <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">{statistics?.total_bets || 0}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="matches" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white">Gerenciar Partidas</CardTitle>
                    <CardDescription className="text-slate-400">Adicione e gerencie partidas de futebol</CardDescription>
                  </div>
                  <Dialog open={isMatchDialogOpen} onOpenChange={setIsMatchDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>Nova Partida</Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-800 border-slate-700">
                      <DialogHeader>
                        <DialogTitle className="text-white">Adicionar Nova Partida</DialogTitle>
                        <DialogDescription className="text-slate-400">Preencha os dados da partida</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="home_team" className="text-slate-200">Time Casa</Label>
                          <Input
                            id="home_team"
                            value={newMatch.home_team}
                            onChange={(e) => setNewMatch({ ...newMatch, home_team: e.target.value })}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="away_team" className="text-slate-200">Time Fora</Label>
                          <Input
                            id="away_team"
                            value={newMatch.away_team}
                            onChange={(e) => setNewMatch({ ...newMatch, away_team: e.target.value })}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="league" className="text-slate-200">Campeonato</Label>
                          <Input
                            id="league"
                            value={newMatch.league}
                            onChange={(e) => setNewMatch({ ...newMatch, league: e.target.value })}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="match_date" className="text-slate-200">Data e Hora</Label>
                          <Input
                            id="match_date"
                            type="datetime-local"
                            value={newMatch.match_date}
                            onChange={(e) => setNewMatch({ ...newMatch, match_date: e.target.value })}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={createMatch}>Criar Partida</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">ID</TableHead>
                      <TableHead className="text-slate-300">Partida</TableHead>
                      <TableHead className="text-slate-300">Campeonato</TableHead>
                      <TableHead className="text-slate-300">Data</TableHead>
                      <TableHead className="text-slate-300">Placar</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                      <TableHead className="text-slate-300">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matches.map((match) => (
                      <TableRow key={match.id} className="border-slate-700">
                        <TableCell className="text-slate-200">{match.id}</TableCell>
                        <TableCell className="text-slate-200 font-medium">{match.home_team} vs {match.away_team}</TableCell>
                        <TableCell className="text-slate-200">{match.league}</TableCell>
                        <TableCell className="text-slate-200">{new Date(match.match_date).toLocaleString('pt-BR')}</TableCell>
                        <TableCell className="text-slate-200">
                          {match.home_score !== null && match.away_score !== null
                            ? `${match.home_score} - ${match.away_score}`
                            : '-'}
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
                            >
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => match.id && deleteMatch(match.id)}
                            >
                              Excluir
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Dialog open={isEditMatchDialogOpen} onOpenChange={setIsEditMatchDialogOpen}>
              <DialogContent className="bg-slate-800 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Editar Partida</DialogTitle>
                  <DialogDescription className="text-slate-400">Atualize os dados da partida</DialogDescription>
                </DialogHeader>
                {selectedMatch && (
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit_home_team" className="text-slate-200">Time Casa</Label>
                      <Input
                        id="edit_home_team"
                        value={selectedMatch.home_team}
                        onChange={(e) => setSelectedMatch({ ...selectedMatch, home_team: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit_away_team" className="text-slate-200">Time Fora</Label>
                      <Input
                        id="edit_away_team"
                        value={selectedMatch.away_team}
                        onChange={(e) => setSelectedMatch({ ...selectedMatch, away_team: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit_league" className="text-slate-200">Campeonato</Label>
                      <Input
                        id="edit_league"
                        value={selectedMatch.league}
                        onChange={(e) => setSelectedMatch({ ...selectedMatch, league: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit_home_score" className="text-slate-200">Placar Casa</Label>
                      <Input
                        id="edit_home_score"
                        type="number"
                        value={selectedMatch.home_score || ''}
                        onChange={(e) => setSelectedMatch({ ...selectedMatch, home_score: e.target.value ? parseInt(e.target.value) : null })}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit_away_score" className="text-slate-200">Placar Fora</Label>
                      <Input
                        id="edit_away_score"
                        type="number"
                        value={selectedMatch.away_score || ''}
                        onChange={(e) => setSelectedMatch({ ...selectedMatch, away_score: e.target.value ? parseInt(e.target.value) : null })}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit_status" className="text-slate-200">Status</Label>
                      <Select
                        value={selectedMatch.status}
                        onValueChange={(value) => setSelectedMatch({ ...selectedMatch, status: value })}
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
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
                  <Button onClick={updateMatch}>Atualizar Partida</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="bets" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-white">Gerenciar Apostas</CardTitle>
                    <CardDescription className="text-slate-400">Adicione e gerencie suas apostas</CardDescription>
                  </div>
                  <Dialog open={isBetDialogOpen} onOpenChange={setIsBetDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>Nova Aposta</Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-800 border-slate-700">
                      <DialogHeader>
                        <DialogTitle className="text-white">Adicionar Nova Aposta</DialogTitle>
                        <DialogDescription className="text-slate-400">Preencha os dados da aposta</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="match_id" className="text-slate-200">Partida</Label>
                          <Select
                            value={newBet.match_id.toString()}
                            onValueChange={(value) => setNewBet({ ...newBet, match_id: parseInt(value) })}
                          >
                            <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                              <SelectValue placeholder="Selecione uma partida" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-700 border-slate-600">
                              {matches.map((match) => (
                                <SelectItem key={match.id} value={match.id!.toString()}>
                                  {match.home_team} vs {match.away_team}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="bet_type" className="text-slate-200">Tipo de Aposta</Label>
                          <Select
                            value={newBet.bet_type}
                            onValueChange={(value) => setNewBet({ ...newBet, bet_type: value })}
                          >
                            <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-700 border-slate-600">
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
                          <Label htmlFor="odds" className="text-slate-200">Odd</Label>
                          <Input
                            id="odds"
                            type="number"
                            step="0.01"
                            value={newBet.odds}
                            onChange={(e) => setNewBet({ ...newBet, odds: parseFloat(e.target.value) })}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="stake" className="text-slate-200">Valor Apostado (R$)</Label>
                          <Input
                            id="stake"
                            type="number"
                            step="0.01"
                            value={newBet.stake}
                            onChange={(e) => setNewBet({ ...newBet, stake: parseFloat(e.target.value) })}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="notes" className="text-slate-200">Notas (opcional)</Label>
                          <Input
                            id="notes"
                            value={newBet.notes || ''}
                            onChange={(e) => setNewBet({ ...newBet, notes: e.target.value })}
                            className="bg-slate-700 border-slate-600 text-white"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={createBet}>Criar Aposta</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">ID</TableHead>
                      <TableHead className="text-slate-300">Partida</TableHead>
                      <TableHead className="text-slate-300">Tipo</TableHead>
                      <TableHead className="text-slate-300">Odd</TableHead>
                      <TableHead className="text-slate-300">Valor</TableHead>
                      <TableHead className="text-slate-300">Retorno Potencial</TableHead>
                      <TableHead className="text-slate-300">Status</TableHead>
                      <TableHead className="text-slate-300">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bets.map((bet) => (
                      <TableRow key={bet.id} className="border-slate-700">
                        <TableCell className="text-slate-200">{bet.id}</TableCell>
                        <TableCell className="text-slate-200 font-medium">{getMatchName(bet.match_id)}</TableCell>
                        <TableCell className="text-slate-200">{betTypeLabels[bet.bet_type]}</TableCell>
                        <TableCell className="text-slate-200">{bet.odds.toFixed(2)}</TableCell>
                        <TableCell className="text-slate-200">R$ {bet.stake.toFixed(2)}</TableCell>
                        <TableCell className="text-slate-200">R$ {bet.potential_return?.toFixed(2)}</TableCell>
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
                            >
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => bet.id && deleteBet(bet.id)}
                            >
                              Excluir
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Dialog open={isEditBetDialogOpen} onOpenChange={setIsEditBetDialogOpen}>
              <DialogContent className="bg-slate-800 border-slate-700">
                <DialogHeader>
                  <DialogTitle className="text-white">Editar Aposta</DialogTitle>
                  <DialogDescription className="text-slate-400">Atualize os dados da aposta</DialogDescription>
                </DialogHeader>
                {selectedBet && (
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit_bet_odds" className="text-slate-200">Odd</Label>
                      <Input
                        id="edit_bet_odds"
                        type="number"
                        step="0.01"
                        value={selectedBet.odds}
                        onChange={(e) => setSelectedBet({ ...selectedBet, odds: parseFloat(e.target.value) })}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit_bet_stake" className="text-slate-200">Valor Apostado (R$)</Label>
                      <Input
                        id="edit_bet_stake"
                        type="number"
                        step="0.01"
                        value={selectedBet.stake}
                        onChange={(e) => setSelectedBet({ ...selectedBet, stake: parseFloat(e.target.value) })}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit_bet_status" className="text-slate-200">Status</Label>
                      <Select
                        value={selectedBet.status}
                        onValueChange={(value) => setSelectedBet({ ...selectedBet, status: value })}
                      >
                        <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="won">Ganha</SelectItem>
                          <SelectItem value="lost">Perdida</SelectItem>
                          <SelectItem value="void">Anulada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="edit_bet_notes" className="text-slate-200">Notas</Label>
                      <Input
                        id="edit_bet_notes"
                        value={selectedBet.notes || ''}
                        onChange={(e) => setSelectedBet({ ...selectedBet, notes: e.target.value })}
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button onClick={updateBet}>Atualizar Aposta</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="statistics" className="space-y-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Estatísticas Detalhadas</CardTitle>
                <CardDescription className="text-slate-400">Análise completa do seu desempenho</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="bg-slate-700 p-4 rounded-lg">
                      <p className="text-slate-400 text-sm">Total de Apostas</p>
                      <p className="text-3xl font-bold text-white">{statistics?.total_bets || 0}</p>
                    </div>
                    <div className="bg-slate-700 p-4 rounded-lg">
                      <p className="text-slate-400 text-sm">Total Investido</p>
                      <p className="text-3xl font-bold text-white">R$ {statistics?.total_stake.toFixed(2) || '0.00'}</p>
                    </div>
                    <div className="bg-slate-700 p-4 rounded-lg">
                      <p className="text-slate-400 text-sm">Total Retornado</p>
                      <p className="text-3xl font-bold text-white">R$ {statistics?.total_return.toFixed(2) || '0.00'}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="bg-slate-700 p-4 rounded-lg">
                      <p className="text-slate-400 text-sm mb-2">Lucro/Prejuízo</p>
                      <p className={`text-4xl font-bold ${statistics && statistics.profit_loss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        R$ {statistics?.profit_loss.toFixed(2) || '0.00'}
                      </p>
                    </div>
                    <div className="bg-slate-700 p-4 rounded-lg">
                      <p className="text-slate-400 text-sm mb-2">ROI (Retorno sobre Investimento)</p>
                      <p className={`text-4xl font-bold ${statistics && statistics.roi >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {statistics?.roi.toFixed(2) || '0.00'}%
                      </p>
                    </div>
                  </div>

                  <div className="bg-slate-700 p-4 rounded-lg">
                    <p className="text-slate-400 text-sm mb-4">Distribuição de Resultados</p>
                    <div className="grid gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-green-500 rounded"></div>
                          <span className="text-slate-200">Apostas Ganhas</span>
                        </div>
                        <span className="text-xl font-bold text-white">{statistics?.won_bets || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-red-500 rounded"></div>
                          <span className="text-slate-200">Apostas Perdidas</span>
                        </div>
                        <span className="text-xl font-bold text-white">{statistics?.lost_bets || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                          <span className="text-slate-200">Apostas Pendentes</span>
                        </div>
                        <span className="text-xl font-bold text-white">{statistics?.pending_bets || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-700 p-4 rounded-lg">
                    <p className="text-slate-400 text-sm mb-2">Taxa de Acerto</p>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="h-8 bg-slate-600 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-500 to-green-400"
                            style={{ width: `${statistics?.win_rate || 0}%` }}
                          ></div>
                        </div>
                      </div>
                      <span className="text-2xl font-bold text-white">{statistics?.win_rate.toFixed(1) || '0.0'}%</span>
                    </div>
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
