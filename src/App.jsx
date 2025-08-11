import React, { useState } from 'react'

export default function App() {
  const [moviePair, setMoviePair] = useState({
    movie1: { title: 'The Matrix', year: 1999 },
    movie2: { title: 'Inception', year: 2010 }
  })

  const handleSelect = (selectedMovie) => {
    alert(`You picked ${selectedMovie.title}!`)
    // TODO: Update Elo and load next pair
  }

  const handleExport = () => {
    alert('Exporting rankings...')
    // TODO: Export logic
  }

  const handleAddMovies = () => {
    alert('Adding new movies...')
    // TODO: Upload CSV logic
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      <main className="flex-grow flex flex-col items-center">
        <MoviePairing
          movie1={moviePair.movie1}
          movie2={moviePair.movie2}
          onSelect={handleSelect}
        />
      </main>
      <Footer onExport={handleExport} onAddMovies={handleAddMovies} />
    </div>
  )
}

function Header() {
  return (
    <header className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white shadow-md w-full text-center">
      <h1 className="text-3xl font-extrabold tracking-wide">Letterboxd Elo Ranking</h1>
      <p className="mt-2 max-w-xl mx-auto">Rank your movies by choosing which one you prefer in each pair. Your rankings improve as you go!</p>
    </header>
  )
}

function MovieCard({ title, year, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className="max-w-xs rounded-lg shadow-lg bg-white hover:shadow-xl transition-shadow duration-300 p-4 flex flex-col items-center"
    >
      <div className="bg-gray-200 w-40 h-60 mb-4 flex items-center justify-center text-gray-400 text-sm select-none">
        Poster Coming Soon
      </div>
      <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
      <p className="text-gray-500">{year}</p>
    </button>
  )
}

function MoviePairing({ movie1, movie2, onSelect }) {
  return (
    <div className="flex flex-col md:flex-row gap-6 justify-center mt-12 px-4">
      <MovieCard title={movie1.title} year={movie1.year} onSelect={() => onSelect(movie1)} />
      <span className="hidden md:flex items-center justify-center px-4 text-gray-400 text-2xl font-bold">VS</span>
      <MovieCard title={movie2.title} year={movie2.year} onSelect={() => onSelect(movie2)} />
    </div>
  )
}

function Footer({ onExport, onAddMovies }) {
  return (
    <footer className="mt-16 flex justify-center gap-4 px-4 py-6 bg-white shadow-inner">
      <button
        onClick={onAddMovies}
        className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-6 rounded-md shadow-md transition-colors"
      >
        Add New Movies
      </button>
      <button
        onClick={onExport}
        className="bg-green-600 hover:bg-green-700 text-white py-2 px-6 rounded-md shadow-md transition-colors"
      >
        Export Rankings CSV
      </button>
    </footer>
  )
}
