import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Quiz from './pages/Quiz';
import ErrorBook from './pages/ErrorBook';
import Stats from './pages/Stats';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/quiz/:mode/:type?" element={<Quiz />} />
      <Route path="/error-book" element={<ErrorBook />} />
      <Route path="/stats" element={<Stats />} />
    </Routes>
  );
}
