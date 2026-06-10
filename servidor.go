package main

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	// Limpa a tela inicial
	fmt.Print("\033[H\033[2J")

	frames := []string{
		`
  🤖/ 
 /||    ==== [ MasterIA Booting... ]
/ || \
 /  \ 
`,
		`
  🤖\ 
 /||    ==== [ MasterIA Booting... ]
/ || \
 /  \ 
`,
	}

	fmt.Println("=========================================================")
	fmt.Println("[MasterIA] Iniciando Servidor Mestre (Go Orchestrator)")
	fmt.Println("=========================================================")

	// Animação de Tchau do Robô por ~3 segundos
	for i := 0; i < 6; i++ {
		fmt.Printf("\033[5;1H") // Volta o cursor para a linha 5
		fmt.Print(frames[i%2])
		time.Sleep(500 * time.Millisecond)
	}

	fmt.Println("\n[MasterIA] Robô a postos! Preparando ambiente...")

	// Mata processos zumbis na porta 3000 antes de iniciar para evitar EADDRINUSE
	// Múltiplos métodos para garantir a limpeza em qualquer sistema Linux
	exec.Command("sh", "-c", "fuser -k 3000/tcp >/dev/null 2>&1 || true").Run()
	exec.Command("sh", "-c", "lsof -t -i:3000 | xargs kill -9 2>/dev/null || true").Run()
	
	fmt.Println("[MasterIA] Porta 3000 limpa e pronta para uso.")

	// Garante que o banco de dados Redis interno (Podman/Docker) está rodando
	// Isso é essencial para o BullMQ e Next.js no modo de produção total
	fmt.Println("[MasterIA] Verificando motor Redis local...")
	exec.Command("sh", "-c", "podman start redis_temp || podman run -d -p 6379:6379 --name redis_temp docker.io/library/redis:alpine").Run()

	// Verifica se foi passada a flag "lite"
	npmArgs := []string{"start"}
	if len(os.Args) > 1 && os.Args[1] == "lite" {
		fmt.Println("[MasterIA] Iniciando no modo LITE...")
		npmArgs = []string{"run", "dev:lite"}
	}

	// Comando para iniciar o servidor JS (Node.js/Next.js)
	cmd := exec.Command("npm", npmArgs...)
	cmd.Env = append(os.Environ(), "PORT=3000")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	// Criar um novo grupo de processos para que possamos matar
	// todo o grupo de uma vez (npm e seus processos filhos)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setpgid: true}

	// Inicia o processo
	if err := cmd.Start(); err != nil {
		log.Fatalf("[MasterIA] Erro ao iniciar o servidor JS: %v", err)
	}

	fmt.Printf("[MasterIA] Processo Node.js rodando (PID: %d)\n", cmd.Process.Pid)
	fmt.Println("[MasterIA] Pressione Ctrl+C para encerrar todos os processos com segurança.")

	// Configuração para capturar sinais de interrupção (Ctrl+C)
	sigs := make(chan os.Signal, 1)
	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)

	// Goroutine que aguarda o sinal de parada
	go func() {
		<-sigs
		fmt.Println("\n[MasterIA] Sinal de interrupção recebido. Desligando processos...")
		// Envia SIGTERM para todo o grupo de processos, garantindo que "next dev" também feche
		if err := syscall.Kill(-cmd.Process.Pid, syscall.SIGTERM); err != nil {
			log.Printf("[MasterIA] Falha ao finalizar processos filhos: %v\n", err)
		}
		// Garante limpeza extra da porta
		exec.Command("sh", "-c", "lsof -t -i:3000 | xargs kill -9 2>/dev/null || true").Run()
		fmt.Println("[MasterIA] Servidor JS encerrado com sucesso.")
		os.Exit(0)
	}()

	// Aguarda o processo principal terminar
	if err := cmd.Wait(); err != nil {
		log.Printf("[MasterIA] Servidor finalizado (status: %v)\n", err)
	} else {
		fmt.Println("[MasterIA] Servidor finalizado normalmente.")
	}
}
