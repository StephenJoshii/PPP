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

// --- NEW BACKEND API URL ---
// After deploying the /api folder to Vercel, you will get a URL.
// You will paste that URL here, followed by /api
// e.g., 'https://your-project-name.vercel.app/api'
const BACKEND_API_URL = 'YOUR_VERCEL_DEPLOYMENT_URL_HERE/api';


function calculatePoints(prediction, result) {
    if (!prediction || !result || typeof prediction.homeScore !== 'number' || typeof prediction.awayScore !== 'number') { return 0; }
    if (prediction.homeScore === result.homeScore && prediction.awayScore === result.awayScore) { return 5; }
    const predResult = prediction.homeScore > prediction.awayScore ? 'H' : prediction.homeScore < prediction.awayScore ? 'A' : 'D';
    const actualResult = result.homeScore > result.awayScore ? 'H' : result.homeScore < result.awayScore ? 'A' : 'D';
    if (predResult === actualResult) { return 2; }
    return 0;
}

// --- Reusable Components ---
function NavigationTabs({ view, setView }) {
    const tabs = ['predictor', 'leaderboard', 'my-predictions'];
    const tabNames = { 'predictor': 'Predictions', 'leaderboard': 'Leaderboard', 'my-predictions': 'My Predictions' };
    return (
        <div className="flex justify-center border-b border-gray-700 mb-6">
            {tabs.map(tab => (
                <button key={tab} onClick={() => setView(tab)} className={`py-2 px-4 md:px-6 text-sm md:text-base font-semibold capitalize ${view === tab ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-500 hover:text-cyan-400'}`}>
                    {tabNames[tab]}
                </button>
            ))}
        </div>
    );
}

function UserHeader({ user }) {
    const handleSignOut = async () => { await signOut(auth); };
    return (
        <div className="flex justify-between items-center mb-4">
            <p className="text-gray-400 truncate pr-2">Welcome, {user.displayName}!</p>
            <button onClick={handleSignOut} className="text-sm text-cyan-400 hover:underline flex-shrink-0">Sign Out</button>
        </div>
    );
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

function Predictor({ user, setView, selectedGameweek, setSelectedGameweek, seasonData }) {
  const [predictions, setPredictions] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (user && seasonData[selectedGameweek]) {
        setIsLoading(true);
        const fetchPredictions = async () => {
            const q = query(collection(db, "predictions"), where("userId", "==", user.uid), where("gameweek", "==", selectedGameweek), orderBy("submittedAt", "desc"), limit(1));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              setPredictions(querySnapshot.docs[0].data().predictions);
            } else {
              setPredictions({});
            }
            setIsLoading(false);
        };
        fetchPredictions();
    } else {
        setIsLoading(false);
    }
  }, [user, selectedGameweek, seasonData]);

  const handlePredictionChange = (fixtureId, team, value) => {
    const score = value === '' ? '' : parseInt(value, 10);
    setPredictions(prev => ({ ...prev, [fixtureId]: { ...(prev[fixtureId] || {}), [team]: isNaN(score) ? '' : score } }));
  };

  const handleSubmit = async () => {
    const gameweekData = seasonData[selectedGameweek];
    if (gameweekData && Object.keys(predictions).length < gameweekData.fixtures.length) {
      alert("Please enter a prediction for all fixtures.");
      return;
    }
    try {
      await addDoc(collection(db, "predictions"), { userId: user.uid, userName: user.displayName, predictions, gameweek: selectedGameweek, submittedAt: new Date() });
      alert(`Your predictions for Gameweek ${selectedGameweek} have been saved!`);
    } catch (e) { console.error("Error adding document: ", e); alert("There was an error saving your predictions."); }
  };
    
  const totalGameweeks = Object.keys(seasonData).length;

  const renderContent = () => {
    const gameweekData = seasonData[selectedGameweek];
    if (!gameweekData) {
        return <div className="text-center text-gray-400 mt-8">Gameweek {selectedGameweek} data not available.</div>;
    }

    const fixtures = gameweekData.fixtures;
    const deadline = new Date(gameweekData.deadline);
    const deadlinePassed = new Date() > deadline;

    if (isLoading) {
        return <div className="text-center text-gray-400">Loading predictions...</div>;
    }

    return (
        <>
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

            <div className="mt-8 text-center">
              {deadlinePassed ? (
                <div className="bg-red-800 text-red-200 border border-red-600 rounded-lg py-3 px-6">The deadline for Gameweek {selectedGameweek} has passed.</div>
              ) : (
                <button onClick={handleSubmit} className="bg-cyan-500 hover:bg-cyan-600 text-gray-900 font-bold py-3 px-8 rounded-lg shadow-lg transition duration-300 transform hover:scale-105">Submit Predictions</button>
              )}
            </div>
        </>
    );
  };

  return (
    <>
      <div className="text-center mb-8">
        <UserHeader user={user} />
        <h1 className="text-3xl md:text-4xl font-bold text-cyan-400">Premier League Predictor</h1>
        <div className="flex items-center justify-center mt-4 space-x-4">
          <button onClick={() => setSelectedGameweek(w => Math.max(1, w - 1))} disabled={selectedGameweek === 1} className="px-4 py-2 bg-gray-700 rounded-md disabled:opacity-50">‹ Prev</button>
          <h2 className="text-xl font-bold text-gray-400">Gameweek {selectedGameweek}</h2>
          <button onClick={() => setSelectedGameweek(w => Math.min(totalGameweeks, w + 1))} disabled={!seasonData[selectedGameweek + 1]} className="px-4 py-2 bg-gray-700 rounded-md disabled:opacity-50">Next ›</button>
        </div>
      </div>
      <NavigationTabs view="predictor" setView={setView} />
      {renderContent()}
    </>
  );
}

function Leaderboard({ user, setView, selectedGameweek, setSelectedGameweek, seasonData }) {
    const [scores, setScores] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [leaderboardType, setLeaderboardType] = useState('gameweek');
    
    useEffect(() => {
        const calculateScores = async () => {
            setIsLoading(true);
            const userScores = {};
            const predictionsQuery = leaderboardType === 'gameweek' ? query(collection(db, "predictions"), where("gameweek", "==", selectedGameweek)) : collection(db, "predictions");
            const predictionsSnapshot = await getDocs(predictionsQuery);

            predictionsSnapshot.forEach(doc => {
                const data = doc.data();
                const userId = data.userId;
                if (!userScores[userId]) { userScores[userId] = { name: data.userName, points: 0 }; }
                if (leaderboardType === 'overall') {
                    const gameweekData = seasonData[data.gameweek];
                    if (gameweekData && gameweekData.results) {
                        Object.keys(data.predictions).forEach(fixtureId => {
                            userScores[userId].points += calculatePoints(data.predictions[fixtureId], gameweekData.results[fixtureId]);
                        });
                    }
                } else {
                    let weeklyPoints = 0;
                    const gameweekData = seasonData[selectedGameweek];
                    if(gameweekData && gameweekData.results) {
                        Object.keys(data.predictions).forEach(fixtureId => {
                            weeklyPoints += calculatePoints(data.predictions[fixtureId], gameweekData.results[fixtureId]);
                        });
                    }
                    userScores[userId].points = Math.max(userScores[userId].points, weeklyPoints);
                }
            });
            setScores(Object.values(userScores).sort((a, b) => b.points - a.points));
            setIsLoading(false);
        };
        if(Object.keys(seasonData).length > 0) calculateScores();
    }, [selectedGameweek, leaderboardType, seasonData]);
    
    const totalGameweeks = Object.keys(seasonData).length;

    return (
        <>
            <div className="text-center mb-8">
                <UserHeader user={user} />
                <h1 className="text-3xl md:text-4xl font-bold text-cyan-400">Leaderboard</h1>
                {leaderboardType === 'gameweek' && (
                  <div className="flex items-center justify-center mt-4 space-x-4">
                    <button onClick={() => setSelectedGameweek(w => Math.max(1, w - 1))} disabled={selectedGameweek === 1} className="px-4 py-2 bg-gray-700 rounded-md disabled:opacity-50">‹ Prev</button>
                    <h2 className="text-xl font-bold text-gray-400">Gameweek {selectedGameweek}</h2>
                    <button onClick={() => setSelectedGameweek(w => Math.min(totalGameweeks, w + 1))} disabled={!seasonData[selectedGameweek + 1]} className="px-4 py-2 bg-gray-700 rounded-md disabled:opacity-50">Next ›</button>
                  </div>
                )}
            </div>
            <NavigationTabs view="leaderboard" setView={setView} />
            
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

function MyPredictions({ user, setView, seasonData }) {
    const [userPredictions, setUserPredictions] = useState({});
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUserPredictions = async () => {
            try {
                setIsLoading(true);
                const q = query(collection(db, "predictions"), where("userId", "==", user.uid), orderBy("gameweek", "asc"));
                const querySnapshot = await getDocs(q);
                const predictionsByWeek = {};

                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data && data.gameweek && data.submittedAt && data.submittedAt.toDate) {
                        const gameweek = data.gameweek;
                        const submittedAt = data.submittedAt.toDate();
                        if (!predictionsByWeek[gameweek] || submittedAt > predictionsByWeek[gameweek].submittedAt) {
                            predictionsByWeek[gameweek] = { predictions: data.predictions || {}, submittedAt: submittedAt };
                        }
                    }
                });
                
                const finalPredictions = {};
                for (const gw in predictionsByWeek) {
                    finalPredictions[gw] = predictionsByWeek[gw].predictions;
                }

                setUserPredictions(finalPredictions);
            } catch (error) { console.error("Error fetching user predictions:", error); } 
            finally { setIsLoading(false); }
        };
        if (user) fetchUserPredictions();
    }, [user]);

    return (
        <>
            <div className="text-center mb-8">
                <UserHeader user={user} />
                <h1 className="text-3xl md:text-4xl font-bold text-cyan-400">My Prediction History</h1>
            </div>
            <NavigationTabs view="my-predictions" setView={setView} />

            {isLoading ? <div className="text-center text-gray-400 mt-8">Loading your history...</div> : (
                <div className="space-y-6 mt-6">
                    {Object.keys(seasonData).sort((a,b) => parseInt(a) - parseInt(b)).map(gameweekNum => {
                        const weeklyPreds = userPredictions[gameweekNum];
                        const weeklyData = seasonData[gameweekNum];
                        if (!weeklyData) return null;
                        const weeklyResults = weeklyData.results;
                        let weeklyTotal = 0;

                        return (
                            <div key={gameweekNum}>
                                <h3 className="text-xl font-bold text-gray-300 mb-2">Gameweek {gameweekNum}</h3>
                                {weeklyPreds ? (
                                    <div className="space-y-2">
                                        {weeklyData.fixtures.map(fixture => {
                                            const pred = weeklyPreds[fixture.id];
                                            const result = weeklyResults ? weeklyResults[fixture.id] : null;
                                            const points = calculatePoints(pred, result);
                                            if(result) weeklyTotal += points;

                                            return (
                                                <div key={fixture.id} className="bg-gray-700 p-3 rounded-lg flex items-center justify-between text-sm">
                                                    <div className="flex-1 text-left truncate pr-2">{fixture.homeTeam} vs {fixture.awayTeam}</div>
                                                    <div className="flex-1 text-center">Your Pick: <span className="font-bold">{pred ? `${pred.homeScore} - ${pred.awayScore}` : 'N/A'}</span></div>
                                                    <div className="flex-1 text-center">Result: <span className="font-bold">{result ? `${result.homeScore} - ${result.awayScore}` : 'Pending'}</span></div>
                                                    <div className={`font-bold w-16 text-right ${points === 5 ? 'text-green-400' : points === 2 ? 'text-yellow-400' : 'text-gray-400'}`}>{result ? `${points} pts` : ''}</div>
                                                </div>
                                            );
                                        })}
                                        {Object.keys(weeklyResults || {}).length > 0 && <div className="text-right font-bold text-gray-300 mt-2">Gameweek Total: {weeklyTotal} pts</div>}
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-500 bg-gray-700 p-3 rounded-lg">No predictions submitted for this week.</div>
                                )}
                            </div>
                        );
                    })}
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
  const [seasonData, setSeasonData] = useState({});
  const [isDataLoading, setIsDataLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => { setUser(currentUser); setIsAuthLoading(false); });
    
    const fetchSeasonData = async () => {
        try {
            // This now calls our own secure backend. No more proxies!
            const res = await fetch(BACKEND_API_URL);
            if (!res.ok) {
              throw new Error(`Backend function returned status ${res.status}`);
            }
            const { fixturesData, teamsData } = await res.json();
            
            const teamMap = {};
            teamsData.teams.forEach(team => {
                teamMap[team.id] = team.name;
            });

            const formattedData = {};
            fixturesData.forEach(fixture => {
                const gameweek = fixture.event;
                if (!gameweek) return;

                if (!formattedData[gameweek]) {
                    formattedData[gameweek] = { fixtures: [], results: {}, deadline: '' };
                }

                const fixtureData = {
                    id: fixture.id,
                    homeTeam: teamMap[fixture.team_h],
                    awayTeam: teamMap[fixture.team_a],
                    finished: fixture.finished,
                    kickoff_time: fixture.kickoff_time,
                };
                
                formattedData[gameweek].fixtures.push(fixtureData);

                if (fixture.finished) {
                    formattedData[gameweek].results[fixture.id] = {
                        homeScore: fixture.team_h_score,
                        awayScore: fixture.team_a_score
                    };
                }
            });

            for (const gw in formattedData) {
                if (formattedData[gw].fixtures.length > 0) {
                    formattedData[gw].deadline = formattedData[gw].fixtures.sort((a,b) => new Date(a.kickoff_time) - new Date(b.kickoff_time))[0].kickoff_time;
                }
            }
            
            let currentGw = 1; 
            const sortedGameweeks = Object.keys(formattedData).sort((a, b) => parseInt(a) - parseInt(b));

            for (const gw of sortedGameweeks) {
                const allFixturesFinished = formattedData[gw].fixtures.every(f => f.finished);
                if (!allFixturesFinished) {
                    currentGw = parseInt(gw);
                    break; 
                }
                currentGw = parseInt(gw);
            }
            
            setSeasonData(formattedData);
            setSelectedGameweek(currentGw);

        } catch (error) {
            console.error("Error fetching season data from backend:", error);
        } finally {
            setIsDataLoading(false);
        }
    };

    if (BACKEND_API_URL && BACKEND_API_URL !== 'YOUR_VERCEL_DEPLOYMENT_URL_HERE/api') {
        fetchSeasonData();
    } else {
        setIsDataLoading(false);
    }
    
    return () => unsubscribe();
  }, []);

  const renderContent = () => {
    if (isAuthLoading || isDataLoading) { return <div className="text-center text-gray-400">Loading Game Data...</div>; }
    if (BACKEND_API_URL === 'YOUR_VERCEL_DEPLOYMENT_URL_HERE/api') {
        return <div className="text-center text-red-400">Backend API URL is missing. Please deploy the /api folder to Vercel and add the URL to the App.jsx file.</div>
    }
    if (user) {
        if (view === 'predictor') { return <Predictor user={user} setView={setView} selectedGameweek={selectedGameweek} setSelectedGameweek={setSelectedGameweek} seasonData={seasonData} />; }
        if (view === 'leaderboard') { return <Leaderboard user={user} setView={setView} selectedGameweek={selectedGameweek} setSelectedGameweek={setSelectedGameweek} seasonData={seasonData} />; }
        if (view === 'my-predictions') { return <MyPredictions user={user} setView={setView} seasonData={seasonData} />; }
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

