import { ThemeProvider } from '@/components/ThemeProvider';
import Layout from '@/components/Layout';

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <Layout>
        <div className="flex flex-col items-center justify-center h-full">
          <div className="max-w-md text-center p-6">
            <h1 className="text-3xl font-bold mb-4">Welcome to qckfx</h1>
            <p className="text-muted-foreground mb-6">
              This is a placeholder UI. The full terminal interface will be implemented in PR4.
            </p>
            <div className="p-4 border rounded-md bg-card text-card-foreground">
              <p className="text-sm">
                The API services have been set up and are ready to be used by the upcoming UI components.
              </p>
            </div>
          </div>
        </div>
      </Layout>
    </ThemeProvider>
  );
}

export default App;