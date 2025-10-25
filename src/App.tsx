function App() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">PersonalBudget 💰</h1>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-bold">
            Bem-vindo ao PersonalBudget!
          </h2>
          <p className="text-xl text-muted-foreground">
            Sua aplicação de gestão financeira pessoal
          </p>
          <div className="mt-6 space-y-2">
            <p className="text-sm text-muted-foreground">
              ✅ Configuração inicial concluída
            </p>
            <p className="text-sm text-muted-foreground">
              ✅ Tailwind CSS configurado
            </p>
            <p className="text-sm text-muted-foreground">
              ✅ Shadcn/ui instalado
            </p>
            <p className="text-sm text-muted-foreground">
              ✅ API client pronto
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
