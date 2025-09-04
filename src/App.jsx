import React from 'react';


const fixtures = [
  { id: 1, homeTeam: 'Manchester United', awayTeam: 'Liverpool' },
  { id: 2, homeTeam: 'Arsenal', awayTeam: 'Chelsea' },
  { id: 3, homeTeam: 'Manchester City', awayTeam: 'Tottenham Hotspur' },
  { id: 4, homeTeam: 'Everton', awayTeam: 'Aston Villa' },
  { id: 5, homeTeam: 'Newcastle United', awayTeam: 'West Ham United' },
];

export default function App() {
  return (

    <div className="bg-gray-900 text-white flex items-center justify-center min-h-screen font-sans">
      <div className="bg-gray-800 rounded-xl shadow-2xl p-6 md:p-8 w-full max-w-2xl mx-4">
        
        {/* Header Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-cyan-400">Premier League Predictor</h1>
          <p className="text-gray-400 mt-2">Enter your score predictions below</p>
        </div>

        {/* Match List Section */}
        <div className="space-y-4">
          
          {fixtures.map((fixture) => (
            <div key={fixture.id} className="bg-gray-700 p-4 rounded-lg flex items-center justify-between">
              {/* Home Team */}
              <span className="font-semibold text-sm md:text-base text-left w-2/5">{fixture.homeTeam}</span>
              
              {/* Score Input Fields */}
              <div className="flex items-center space-x-2">
                <input type="number" className="bg-gray-900 text-white w-12 h-10 text-center rounded-md font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400" min="0" />
                <span className="text-gray-400 font-bold">:</span>
                <input type="number" className="bg-gray-900 text-white w-12 h-10 text-center rounded-md font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400" min="0" />
              </div>

              {/* Away Team */}
              <span className="font-semibold text-sm md:text-base text-right w-2/5">{fixture.awayTeam}</span>
            </div>
          ))}
        </div>

        {/* Submit Button */}
        <div className="mt-8 text-center">
          <button className="bg-cyan-500 hover:bg-cyan-600 text-gray-900 font-bold py-3 px-8 rounded-lg shadow-lg transition duration-300 transform hover:scale-105">
            Submit Predictions
          </button>
        </div>

      </div>
    </div>
  );
}

