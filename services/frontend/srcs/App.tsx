import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from '@/pages/Home'; // エイリアスパス @ を使用

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* 将来的に他のページへのルートを追加 */}
        {/* <Route path="/index.html" element={<Home />} /> */}
      </Routes>
    </Router>
  );
};

export default App;
