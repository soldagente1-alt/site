import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";

const Landing = lazy(() => import("../Site/Landing"));
const FirebaseLogin = lazy(() => import("../App/Components/firebaseLogin"));
const Simulator = lazy(() => import("../App/Components/Simulator"));
const FranchiseRegister = lazy(() => import("../App/Franchise/FranchiseRegister"));
const InvestorRegister = lazy(() => import("../App/Investor/InvestorRegister"));
const FamilyRegister = lazy(() => import("../App/Family/FamilyRegister"));
const CriarAcesso = lazy(() => import("../App/Components/CriarAcesso"));
const WaitlistPage = lazy(() => import("../App/Components/WaitListPage"));
const PreapprovedPage = lazy(() => import("../App/Components/PreapprovedPage"));
const PrivaceLGPD = lazy(() => import("../App/Public/privaceLGPD"));
const WaitlistTermsPage = lazy(() => import("../App/Public/WaitlistTermsPage"));
const WaitlistLanding = lazy(() => import("../App/Components/WaitlistLanding"));

function Loader() {
  return <div>Carregando...</div>;
}

export default function PublicRoutes() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/firebaseLogin" element={<FirebaseLogin />} />
        <Route path="/simulator" element={<Simulator />} />
        <Route path="/franchiseregister" element={<FranchiseRegister />} />
        <Route path="/investorregister" element={<InvestorRegister />} />
        <Route path="/familyregister" element={<FamilyRegister />} />
        <Route path="/criaracesso" element={<CriarAcesso />} />
        <Route path="/waitlist" element={<WaitlistPage />} />
        <Route path="/preapproved" element={<PreapprovedPage />} />
        <Route path="/privacelgpd" element={<PrivaceLGPD />} />
        <Route path="/waitlist-terms" element={<WaitlistTermsPage />} />
        <Route path="/fila" element={<WaitlistLanding />} />
      </Routes>
    </Suspense>
  );
}