import { Route, Router } from 'wouter';
import Previous from './Previous.tsx';
import { Next } from './Next.tsx';

export function App() {
    return (
        <Router>
            <Route path={'/'} component={Previous} />
            <Route path={'/next'} component={Next} />
        </Router>
    );
}

export default App;
