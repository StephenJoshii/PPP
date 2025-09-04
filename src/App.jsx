import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged,
  signOut
} from "firebase/auth";

// --- START FIREBASE CONFIGURATION ---
const firebaseConfig = {

  apiKey: process.env.REACT_APP_API_KEY,

  authDomain: process.env.REACT_APP_AUTH_DOMAIN,

  projectId: process.env.REACT_APP_PROJECT_ID,

  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,

  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,

  appId: process.env.REACT_APP_APP_ID

};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
// --- END FIREBASE CONFIGURATION ---

// --- SEASON DATA ---
const seasonData = {
  1: {
    // Deadline is in the past, so this week should be locked.
    deadline: '2025-09-01T12:00:00Z',
    fixtures: [
      { id: 1, homeTeam: 'Manchester United', awayTeam: 'Liverpool' },
      { id: 2, homeTeam: 'Arsenal', awayTeam: 'Chelsea' },
      { id: 3, homeTeam: 'Manchester City', awayTeam: 'Tottenham Hotspur' },
    ],
    results: {
      1: { homeScore: 2, awayScore: 2 },
      2: { homeScore: 3, awayScore: 1 },
      3: { homeScore: 0, awayScore: 1 },
    }
  },
  2: {
    // Deadline is in the future, so this week should be open for predictions.
    deadline: '2025-09-10T12:00:00Z',
    fixtures: [
      { id: 6, homeTeam: 'West Ham United', awayTeam: 'Arsenal' },
      { id: 7, homeTeam: 'Liverpool', awayTeam: 'Everton' },
      { id: 8, homeTeam: 'Chelsea', awayTeam: 'Manchester City' },
    ],
    results: {
      6: { homeScore: 1, awayScore: 1 },
      7: { homeScore: 2, awayScore: 0 },
      8: { homeScore: 2, awayScore: 2 },
    }
  }
};

function calculatePoints(prediction, result) {
    if (!prediction || !result || typeof prediction.homeScore === 'undefined' || typeof prediction.awayScore === 'undefined') {
        return 0;
    }
    if (prediction.homeScore === result.homeScore && prediction.awayScore === result.awayScore) { return 5; }
    const predResult = prediction.homeScore > prediction.awayScore ? 'H' : prediction.homeScore < prediction.awayScore ? 'A' : 'D';
    const actualResult = result.homeScore > result.awayScore ? 'H' : result.homeScore < result.awayScore ? 'A' : 'D';
    if (predResult === actualResult) { return 2; }
    return 0;
}

function SignIn() {
  const signInWithGoogle = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  };
  return (
    <div className="text-center">
      <h1 className="text-3xl md:text-4xl font-bold text-cyan-400 mb-4">Welcome to the Predictor</h1>
      <p className="text-gray-400 mb-8">Please sign in to continue.</p>
      <button onClick={signInWithGoogle} className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition duration-300 transform hover:scale-105">
        Sign in with Google
      </button>
    </div>
  );
}

function Predictor({ user, setView, selectedGameweek, setSelectedGameweek }) {
  const [predictions, setPredictions] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  
  const gameweekData = seasonData[selectedGameweek];
  const fixtures = gameweekData.fixtures;
  const deadline = new Date(gameweekData.deadline);
  const deadlinePassed = new Date() > deadline;

  useEffect(() => {
    const fetchPredictions = async () => {
      if (user) {
        setIsLoading(true);
        const q = query(collection(db, "predictions"), where("userId", "==", user.uid), where("gameweek", "==", selectedGameweek), orderBy("submittedAt", "desc"), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setPredictions(querySnapshot.docs[0].data().predictions);
        } else {
          setPredictions({});
        }
        setIsLoading(false);
      }
    };
    fetchPredictions();
  }, [user, selectedGameweek]);

  const handlePredictionChange = (fixtureId, team, value) => {
    const score = value === '' ? '' : parseInt(value, 10);
    setPredictions(prev => ({ ...prev, [fixtureId]: { ...(prev[fixtureId] || {}), [team]: score >= 0 ? score : '' } }));
  };

  const handleSubmit = async () => {
    if (Object.keys(predictions).length < fixtures.length) {
      alert("Please enter a prediction for all fixtures.");
      return;
    }
    try {
      await addDoc(collection(db, "predictions"), { userId: user.uid, userName: user.displayName, predictions, gameweek: selectedGameweek, submittedAt: new Date() });
      alert(`Your predictions for Gameweek ${selectedGameweek} have been saved!`);
    } catch (e) { console.error("Error adding document: ", e); alert("There was an error saving your predictions."); }
  };
  
  const handleSignOut = async () => { await signOut(auth); };
  
  const totalGameweeks = Object.keys(seasonData).length;

  return (
    <>
      <div className="text-center mb-8">
        <div className="flex justify-between items-center mb-4"><p className="text-gray-400">Welcome, {user.displayName}!</p><button onClick={handleSignOut} className="text-sm text-cyan-400 hover:underline">Sign Out</button></div>
        <h1 className="text-3xl md:text-4xl font-bold text-cyan-400">Premier League Predictor</h1>
        <div className="flex items-center justify-center mt-4 space-x-4">
          <button onClick={() => setSelectedGameweek(w => Math.max(1, w - 1))} disabled={selectedGameweek === 1} className="px-4 py-2 bg-gray-700 rounded-md disabled:opacity-50">‹ Prev</button>
          <h2 className="text-xl font-bold text-gray-400">Gameweek {selectedGameweek}</h2>
          <button onClick={() => setSelectedGameweek(w => Math.min(totalGameweeks, w + 1))} disabled={selectedGameweek === totalGameweeks} className="px-4 py-2 bg-gray-700 rounded-md disabled:opacity-50">Next ›</button>
        </div>
      </div>
      <div className="flex justify-center border-b border-gray-700 mb-6"><button className="py-2 px-6 text-cyan-400 border-b-2 border-cyan-400 font-semibold">Predictions</button><button onClick={() => setView('leaderboard')} className="py-2 px-6 text-gray-500 hover:text-cyan-400 font-semibold">Leaderboard</button></div>
      
      {isLoading ? <div className="text-center text-gray-400">Loading predictions...</div> : (
        <div className="space-y-4">
          {fixtures.map((fixture) => (
            <div key={fixture.id} className="bg-gray-700 p-4 rounded-lg flex items-center justify-between">
              <span className="font-semibold text-sm md:text-base text-left w-2/5">{fixture.homeTeam}</span>
              <div className="flex items-center space-x-2">
                <input type="number" disabled={deadlinePassed} className="bg-gray-900 text-white w-12 h-10 text-center rounded-md font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:opacity-50" min="0" value={predictions[fixture.id]?.homeScore ?? ''} onChange={(e) => handlePredictionChange(fixture.id, 'homeScore', e.target.value)} />
                <span className="text-gray-400 font-bold">:</span>
                <input type="number" disabled={deadlinePassed} className="bg-gray-900 text-white w-12 h-10 text-center rounded-md font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:opacity-50" min="0" value={predictions[fixture.id]?.awayScore ?? ''} onChange={(e) => handlePredictionChange(fixture.id, 'awayScore', e.target.value)} />
              </div>
              <span className="font-semibold text-sm md:text-base text-right w-2/5">{fixture.awayTeam}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 text-center">
        {deadlinePassed ? (
          <div className="bg-red-800 text-red-200 border border-red-600 rounded-lg py-3 px-6">
            The deadline for Gameweek {selectedGameweek} has passed. Predictions are locked.
          </div>
        ) : (
          <button onClick={handleSubmit} className="bg-cyan-500 hover:bg-cyan-600 text-gray-900 font-bold py-3 px-8 rounded-lg shadow-lg transition duration-300 transform hover:scale-105">
            Submit Predictions
          </button>
        )}
      </div>
    </>
  );
}

function Leaderboard({ setView, selectedGameweek, setSelectedGameweek }) {
    const [scores, setScores] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [leaderboardType, setLeaderboardType] = useState('gameweek');
    
    useEffect(() => {
        const calculateScores = async () => {
            setIsLoading(true);
            const userScores = {};
            const predictionsQuery = leaderboardType === 'gameweek' 
                ? query(collection(db, "predictions"), where("gameweek", "==", selectedGameweek))
                : collection(db, "predictions");
            
            const predictionsSnapshot = await getDocs(predictionsQuery);

            predictionsSnapshot.forEach(doc => {
                const data = doc.data();
                const userId = data.userId;
                if (!userScores[userId]) {
                    userScores[userId] = { name: data.userName, points: 0 };
                }

                if (leaderboardType === 'overall') {
                    const gameweekResults = seasonData[data.gameweek]?.results;
                    if (gameweekResults) {
                        Object.keys(data.predictions).forEach(fixtureId => {
                            const prediction = data.predictions[fixtureId];
                            const result = gameweekResults[fixtureId];
                            userScores[userId].points += calculatePoints(prediction, result);
                        });
                    }
                } else {
                    let weeklyPoints = 0;
                    const gameweekResults = seasonData[selectedGameweek].results;
                    Object.keys(data.predictions).forEach(fixtureId => {
                        const prediction = data.predictions[fixtureId];
                        const result = gameweekResults ? gameweekResults[fixtureId] : undefined;
                        weeklyPoints += calculatePoints(prediction, result);
                    });
                    userScores[userId].points = Math.max(userScores[userId].points, weeklyPoints);
                }
            });

            setScores(Object.values(userScores).sort((a, b) => b.points - a.points));
            setIsLoading(false);
        };
        calculateScores();
    }, [selectedGameweek, leaderboardType]);
    
    const totalGameweeks = Object.keys(seasonData).length;

    return (
        <>
            <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-cyan-400">Leaderboard</h1>
                {leaderboardType === 'gameweek' && (
                  <div className="flex items-center justify-center mt-4 space-x-4">
                    <button onClick={() => setSelectedGameweek(w => Math.max(1, w - 1))} disabled={selectedGameweek === 1} className="px-4 py-2 bg-gray-700 rounded-md disabled:opacity-50">‹ Prev</button>
                    <h2 className="text-xl font-bold text-gray-400">Gameweek {selectedGameweek}</h2>
                    <button onClick={() => setSelectedGameweek(w => Math.min(totalGameweeks, w + 1))} disabled={selectedGameweek === totalGameweeks} className="px-4 py-2 bg-gray-700 rounded-md disabled:opacity-50">Next ›</button>
                  </div>
                )}
            </div>
            <div className="flex justify-center border-b border-gray-700 mb-6"><button onClick={() => setView('predictor')} className="py-2 px-6 text-gray-500 hover:text-cyan-400 font-semibold">Predictions</button><button className="py-2 px-6 text-cyan-400 border-b-2 border-cyan-400 font-semibold">Leaderboard</button></div>
            
            <div className="flex justify-center mb-6 space-x-2">
                <button onClick={() => setLeaderboardType('gameweek')} className={leaderboardType === 'gameweek' ? "bg-cyan-500 text-gray-900 font-bold py-2 px-4 rounded-lg" : "bg-gray-700 font-bold py-2 px-4 rounded-lg"}>Gameweek</button>
                <button onClick={() => setLeaderboardType('overall')} className={leaderboardType === 'overall' ? "bg-cyan-500 text-gray-900 font-bold py-2 px-4 rounded-lg" : "bg-gray-700 font-bold py-2 px-4 rounded-lg"}>Overall</button>
            </div>

            {isLoading ? <div className="text-center text-gray-400">Calculating scores...</div> : (
                <div className="space-y-3">
                    {scores.map((score, index) => (
                        <div key={index} className="bg-gray-700 p-4 rounded-lg flex items-center justify-between">
                            <div className="flex items-center"><span className="text-lg font-bold text-cyan-400 w-8">{index + 1}</span><span className="font-semibold">{score.name}</span></div>
                            <span className="font-bold text-xl">{score.points}</span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [view, setView] = useState('predictor');
  const [selectedGameweek, setSelectedGameweek] = useState(1);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => { setUser(currentUser); setIsAuthLoading(false); });
    return () => unsubscribe();
  }, []);

  const renderContent = () => {
    if (isAuthLoading) { return <div className="text-center text-gray-400">Authenticating...</div>; }
    if (user) {
        if (view === 'predictor') { return <Predictor user={user} setView={setView} selectedGameweek={selectedGameweek} setSelectedGameweek={setSelectedGameweek} />; }
        return <Leaderboard setView={setView} selectedGameweek={selectedGameweek} setSelectedGameweek={setSelectedGameweek} />;
    }
    return <SignIn />;
  }

  return (
    <div className="bg-gray-900 text-white flex items-center justify-center min-h-screen font-sans">
      <div className="bg-gray-800 rounded-xl shadow-2xl p-6 md:p-8 w-full max-w-2xl mx-4">
        {renderContent()}
      </div>
    </div>
  );
}

