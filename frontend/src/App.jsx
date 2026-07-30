import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar';
import UploadView from './components/UploadView';
import ConceptMapView from './components/ConceptMapView';
import TutorView from './components/TutorView';
import TeachNoviceView from './components/TeachNoviceView';
import SpeakYourModelView from './components/SpeakYourModelView';
import QuizView from './components/QuizView';
import DashboardView from './components/DashboardView';
import LoginPage from './components/LoginPage';
import LoginModal from './components/LoginModal';
import { deleteDocumentData } from './api';

export default function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [currentDoc, setCurrentDoc] = useState(null);
  const [selectedTeachingConcept, setSelectedTeachingConcept] = useState(null);
  const [selectedSpeakConcept, setSelectedSpeakConcept] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [simplifyMode, setSimplifyMode] = useState(false);
  const [previousLanguage, setPreviousLanguage] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('mentra_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch(e) {}
    }
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setIsLoginOpen(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('mentra_user');
    setUser(null);
  };

  if (!user) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const handleIngestSuccess = (docData) => {
    setCurrentDoc(docData);
    if (docData?.preferred_language) {
      setPreferredLanguage(docData.preferred_language);
    }
    setActiveTab('concepts');
  };

  const handleLanguageChange = (newLangCode, newSimplifyMode) => {
    if (newLangCode !== preferredLanguage) {
      setPreviousLanguage(preferredLanguage);
    }
    setPreferredLanguage(newLangCode);
    setSimplifyMode(newSimplifyMode);
  };

  const handleStartTeaching = (concept) => {
    const conceptObj = typeof concept === 'string'
      ? currentDoc?.concepts?.find(c => c.name === concept || c.id === concept) || { id: 1, name: concept }
      : concept;
    setSelectedTeachingConcept(conceptObj);
    setActiveTab('teach');
  };

  const handleStartSpeakModel = (concept) => {
    const conceptObj = typeof concept === 'string'
      ? currentDoc?.concepts?.find(c => c.name === concept || c.id === concept) || { id: 1, name: concept }
      : concept;
    setSelectedSpeakConcept(conceptObj);
    setActiveTab('speak');
  };

  const handleDeleteData = async () => {
    if (!currentDoc) return;
    if (window.confirm('Are you sure you want to delete all stored data for this session? This action is permanent.')) {
      try {
        await deleteDocumentData(currentDoc.document_id);
        setCurrentDoc(null);
        setActiveTab('upload');
        alert('Session data purged successfully.');
      } catch (err) {
        alert('Failed to delete session data.');
      }
    }
  };

  const fallbackConcept = currentDoc?.concepts?.[0] || { id: 1, name: 'Core Foundations' };

  const pageVariants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
    exit: { opacity: 0, y: -4, transition: { duration: 0.15, ease: 'easeIn' } }
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col font-body-md">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentDoc={currentDoc}
        onDeleteData={handleDeleteData}
        user={user}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={handleLogout}
        preferredLanguage={preferredLanguage}
        simplifyMode={simplifyMode}
        onLanguageChange={handleLanguageChange}
      />

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      <main className="md:ml-72 flex-1 flex flex-col relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="flex-1 flex flex-col w-full"
          >
            {activeTab === 'upload' && (
              <UploadView onIngestSuccess={handleIngestSuccess} preferredLanguage={preferredLanguage} />
            )}

            {activeTab === 'concepts' && (
              <ConceptMapView
                currentDoc={currentDoc}
                onStartTutor={() => setActiveTab('tutor')}
                onStartTeachNovice={handleStartTeaching}
                onStartSpeakModel={handleStartSpeakModel}
              />
            )}

            {activeTab === 'tutor' && (
              <TutorView 
                currentDoc={currentDoc} 
                preferredLanguage={preferredLanguage}
                simplifyMode={simplifyMode}
                previousLanguage={previousLanguage}
              />
            )}

            {activeTab === 'teach' && (
              <TeachNoviceView
                currentDoc={currentDoc}
                concept={selectedTeachingConcept || fallbackConcept}
                onBack={() => setActiveTab('concepts')}
                onNavigateTab={setActiveTab}
              />
            )}

            {activeTab === 'speak' && (
              <SpeakYourModelView
                currentDoc={currentDoc}
                concept={selectedSpeakConcept || fallbackConcept}
                onBack={() => setActiveTab('concepts')}
                onNavigateTab={setActiveTab}
              />
            )}

            {activeTab === 'quiz' && (
              <QuizView
                currentDoc={currentDoc}
                onQuizComplete={() => setActiveTab('dashboard')}
              />
            )}

            {activeTab === 'dashboard' && (
              <DashboardView
                currentDoc={currentDoc}
                onSelectConceptForQuiz={() => setActiveTab('quiz')}
                onSelectConceptForTeaching={handleStartTeaching}
                onNavigateTab={setActiveTab}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
