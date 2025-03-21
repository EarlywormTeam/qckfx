import { ThemeProvider } from '@/components/ThemeProvider';
import Layout from '@/components/Layout';
import Terminal from '@/components/Terminal';
import { TerminalProvider, useTerminal } from '@/context/TerminalContext';

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <TerminalProvider>
        <Layout>
          <div className="flex items-center justify-center h-full p-4">
            <TerminalContainer fullScreen />
          </div>
        </Layout>
      </TerminalProvider>
    </ThemeProvider>
  );
}

// Create a container component that connects Terminal to context
function TerminalContainer({ fullScreen }: { fullScreen?: boolean }) {
  const { 
    state, 
    addUserMessage, 
    addAssistantMessage, 
    addToolMessage, 
    addErrorMessage, 
    addSystemMessage,
    clearMessages, 
    setProcessing,
    addToHistory 
  } = useTerminal();
  
  // Simple function to handle commands (demo purposes)
  const handleCommand = (command: string) => {
    // Add command to history
    addToHistory(command);
    
    // Add user message
    addUserMessage(command);
    
    // Set processing state
    setProcessing(true);
    
    // Simple echo response (in a real app, this would be handled by API)
    setTimeout(() => {
      // Demo different message types based on command
      if (command.startsWith('!error')) {
        addErrorMessage('This is an error message!');
      } else if (command.startsWith('!tool')) {
        addToolMessage('Tool output with \u001b[32mgreen\u001b[0m and \u001b[34mblue\u001b[0m text.');
      } else if (command.startsWith('!system')) {
        addSystemMessage('This is a system message.');
      } else {
        addAssistantMessage(`You said: ${command}`);
      }
      
      // Set processing state back to false
      setProcessing(false);
    }, 500);
  };
  
  return (
    <Terminal 
      fullScreen={fullScreen} 
      messages={state.messages}
      onCommand={handleCommand}
      onClear={clearMessages}
      inputDisabled={state.isProcessing}
    />
  );
}

export default App;