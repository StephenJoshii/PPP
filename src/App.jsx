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
// Remember to replace this with your actual firebaseConfig object
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
// --- END FIREBASE CONFIGURATION ---

// --- SEASON DATA ---
const currentGameweek = 1; // We can change this to simulate different weeks

const seasonData = {
  1: {
    fixtures: [
      { id: 1, homeTeam: 'Manchester United', awayTeam: 'Liverpool' },
      { id: 2, homeTeam: 'Arsenal', awayTeam: 'Chelsea' },
      { id: 3, homeTeam: 'Manchester City', awayTeam: 'Tottenham Hotspur' },
      { id: 4, homeTeam: 'Everton', awayTeam: 'Aston Villa' },
      { id: 5, homeTeam: 'Newcastle United', awayTeam: 'West Ham United' },
    ],
    results: {
      1: { homeScore: 2, awayScore: 2 },
      2: { homeScore: 3, awayScore: 1 },
      3: { homeScore: 0, awayScore: 1 },
      4: { homeScore: 1, awayScore: 0 },
      5: { homeScore: 4, awayScore: 3 },
    }
  },
  // We can add Gameweek 2 data here later
  2: {
    fixtures: [
      // ... next week's fixtures
    ]
  }
};

const fixtures = seasonData[currentGameweek].fixtures;
const gameweekResults = seasonData[currentGameweek].results;


function calculatePoints(prediction, result) {
    if (!prediction || typeof prediction.homeScore === 'undefined' || typeof prediction.awayScore === 'undefined') {
        return 0;
    }
    if (prediction.homeScore === result.homeScore && prediction.awayScore === result.awayScore) {
        return 5; // Correct score
    }
    const predResult = prediction.homeScore > prediction.awayScore ? 'H' : prediction.homeScore < prediction.awayScore ? 'A' : 'D';
    const actualResult = result.homeScore > result.awayScore ? 'H' : result.homeScore < result.awayScore ? 'A' : 'D';
    if (predResult === actualResult) {
        return 2; // Correct result
    }
    return 0; // Incorrect
}


// Component for the Sign-In screen
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

// Component for the main prediction interface
function Predictor({ user, setView }) {
  const [predictions, setPredictions] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPredictions = async () => {
      if (user) {
        const q = query(collection(db, "predictions"), where("userId", "==", user.uid), where("gameweek", "==", currentGameweek), orderBy("submittedAt", "desc"), limit(1));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          setPredictions(querySnapshot.docs[0].data().predictions);
        }
        setIsLoading(false);
      }
    };
    fetchPredictions();
  }, [user]);

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
      await addDoc(collection(db, "predictions"), { userId: user.uid, userName: user.displayName, predictions, gameweek: currentGameweek, submittedAt: new Date() });
      alert(`Your predictions for Gameweek ${currentGameweek} have been saved!`);
    } catch (e) {
      console.error("Error adding document: ", e);
      alert("There was an error saving your predictions.");
    }
  };

  const handleSignOut = async () => { await signOut(auth); };

  if (isLoading) { return <div className="text-center text-gray-400">Loading your predictions...</div>; }

  return (
    <>
      <div className="text-center mb-8">
        <div className="flex justify-between items-center mb-4"><p className="text-gray-400">Welcome, {user.displayName}!</p><button onClick={handleSignOut} className="text-sm text-cyan-400 hover:underline">Sign Out</button></div>
        <h1 className="text-3xl md:text-4xl font-bold text-cyan-400">Premier League Predictor</h1>
        <h2 className="text-xl font-bold text-gray-400 mt-2">Gameweek {currentGameweek}</h2>
      </div>
      <div className="flex justify-center border-b border-gray-700 mb-6"><button className="py-2 px-6 text-cyan-400 border-b-2 border-cyan-400 font-semibold">Predictions</button><button onClick={() => setView('leaderboard')} className="py-2 px-6 text-gray-500 hover:text-cyan-400 font-semibold">Leaderboard</button></div>
      <div className="space-y-4">
        {fixtures.map((fixture) => (
          <div key={fixture.id} className="bg-gray-700 p-4 rounded-lg flex items-center justify-between">
            <span className="font-semibold text-sm md:text-base text-left w-2/5">{fixture.homeTeam}</span>
            <div className="flex items-center space-x-2">
              <input type="number" className="bg-gray-900 text-white w-12 h-10 text-center rounded-md font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400" min="0" value={predictions[fixture.id]?.homeScore ?? ''} onChange={(e) => handlePredictionChange(fixture.id, 'homeScore', e.target.value)} />
              <span className="text-gray-400 font-bold">:</span>
              <input type="number" className="bg-gray-900 text-white w-12 h-10 text-center rounded-md font-bold focus:outline-none focus:ring-2 focus:ring-cyan-400" min="0" value={predictions[fixture.id]?.awayScore ?? ''} onChange={(e) => handlePredictionChange(fixture.id, 'awayScore', e.target.value)} />
            </div>
            <span className="font-semibold text-sm md:text-base text-right w-2/5">{fixture.awayTeam}</span>
          </div>
        ))}
      </div>
      <div className="mt-8 text-center"><button onClick={handleSubmit} className="bg-cyan-500 hover:bg-cyan-600 text-gray-900 font-bold py-3 px-8 rounded-lg shadow-lg transition duration-300 transform hover:scale-105">Submit Predictions</button></div>
    </>
  );
}

// Component for the Leaderboard view
function Leaderboard({ setView }) {
    const [scores, setScores] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const calculateScores = async () => {
            // Only fetch predictions for the current gameweek
            const q = query(collection(db, "predictions"), where("gameweek", "==", currentGameweek));
            const predictionsSnapshot = await getDocs(q);
            const userScores = {};

            predictionsSnapshot.forEach(doc => {
                const data = doc.data();
                const userId = data.userId;
                let totalPoints = 0;

                Object.keys(data.predictions).forEach(fixtureId => {
                    const prediction = data.predictions[fixtureId];
                    const result = gameweekResults[fixtureId];
                    if (prediction && result) {
                        totalPoints += calculatePoints(prediction, result);
                    }
                });
                
                if (!userScores[userId] || totalPoints > userScores[userId].points) {
                    userScores[userId] = { name: data.userName, points: totalPoints };
                }
            });

            const sortedScores = Object.values(userScores).sort((a, b) => b.points - a.points);
            setScores(sortedScores);
            setIsLoading(false);
        };

        calculateScores();
    }, []);

    return (
        <>
            <div className="text-center mb-8">
                <h1 className="text-3xl md:text-4xl font-bold text-cyan-400">Leaderboard</h1>
                <h2 className="text-xl font-bold text-gray-400 mt-2">Gameweek {currentGameweek}</h2>
            </div>
            <div className="flex justify-center border-b border-gray-700 mb-6"><button onClick={() => setView('predictor')} className="py-2 px-6 text-gray-500 hover:text-cyan-400 font-semibold">Predictions</button><button className="py-2 px-6 text-cyan-400 border-b-2 border-cyan-400 font-semibold">Leaderboard</button></div>
            
            {isLoading ? <div className="text-center text-gray-400">Calculating scores...</div> : (
                <div className="space-y-3">
                    {scores.map((score, index) => (
                        <div key={index} className="bg-gray-700 p-4 rounded-lg flex items-center justify-between">
                            <div className="flex items-center">
                                <span className="text-lg font-bold text-cyan-400 w-8">{index + 1}</span>
                                <span className="font-semibold">{score.name}</span>
                            </div>
                            <span className="font-bold text-xl">{score.points}</span>
                        </div>
                    ))}
                </div>
            )}
        </>
    );
}


// Main App component that handles auth and view state
export default function App() {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [view, setView] = useState('predictor');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const renderContent = () => {
    if (isAuthLoading) { return <div className="text-center text-gray-400">Authenticating...</div>; }
    if (user) {
        if (view === 'predictor') { return <Predictor user={user} setView={setView} />; }
        return <Leaderboard setView={setView} />;
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

