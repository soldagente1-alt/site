import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AnalyticsListener from "./components/AnalyticsListener";

/* ========= PROTECTED SHELL ========= */
const PrivateArea = lazy(() => import("./routes/PrivateArea"));

/* ========= LAYOUTS ========= */
const FamilyLayout = lazy(() => import("./App/Family/FamilyLayout"));
const AdminLayout = lazy(() => import("./App/Admin/AdminLayout"));
const FranchiseLayout = lazy(() => import("./App/Franchise/FranchiseLayout"));
const InvestorLayout = lazy(() => import("./App/Investor/InvestorLayout"));

/* ========= PUBLIC PAGES ========= */
const Landing = lazy(() => import("./Site/Landing"));
const FirebaseLogin = lazy(() => import("./App/Components/firebaseLogin"));
const FranchiseRegister = lazy(() => import("./App/Franchise/FranchiseRegister"));
const InvestorRegister = lazy(() => import("./App/Investor/InvestorRegister"));
const Simulator = lazy(() => import("./App/Components/Simulator"));
const FamilyRegister = lazy(() => import("./App/Family/FamilyRegister"));
const CriarAcesso = lazy(() => import("./App/Components/CriarAcesso"));
const WaitlistPage = lazy(() => import("./App/Components/WaitListPage"));
const PreapprovedPage = lazy(() => import("./App/Components/PreapprovedPage"));
const PrivaceLGPD = lazy(() => import("./App/Public/privaceLGPD"));
const WaitlistTermsPage = lazy(() => import("./App/Public/WaitlistTermsPage"));
const WaitlistLanding = lazy(() => import("./App/Components/WaitlistLanding"));

/* ========= FAMILY PAGES ========= */
const FamilyDashboard = lazy(() => import("./App/Family/FamilyDashboard"));
const FamilyPayments = lazy(() => import("./App/Family/FamilyPayments"));
const FamilyPlan = lazy(() => import("./App/Family/FamilyPlan"));
const FamilyEducation = lazy(() => import("./App/Family/FamilyEducation"));
const FamilyContract = lazy(() => import("./App/Family/FamilyContract"));
const FamilyContractView = lazy(() => import("./App/Family/FamilyContractView"));
const Profile = lazy(() => import("./App/Family/Profile"));
const FamilySupportCenter = lazy(() => import("./App/Family/FamilySupportCenter"));
const FamilyDocuments = lazy(() => import("./App/Family/FamilyDocuments"));

/* ========= ADMIN PAGES ========= */
const AdminDashboard = lazy(() => import("./App/Admin/AdminDashboard"));
const AdminFamilies = lazy(() => import("./App/Admin/AdminFamilies"));
const AdminFranchises = lazy(() => import("./App/Admin/AdminFranchises"));
const AdminInvestors = lazy(() => import("./App/Admin/AdminInvestors"));
const AdminFinance = lazy(() => import("./App/Admin/AdminFinance"));
const AdminNotifications = lazy(() => import("./App/Admin/AdminNotifications"));
const AdminFranchiseApprovals = lazy(() => import("./App/Admin/AdminFranchiseApprovals"));
const AdminPlans = lazy(() => import("./App/Admin/AdminPlans"));
const AdminPayments = lazy(() => import("./App/Admin/AdminPayments"));
const AdminContract = lazy(() => import("./App/Admin/AdminContract"));
const AdminEducationVideos = lazy(() => import("./App/Admin/AdminEducationVideos"));
const AdminTickets = lazy(() => import("./App/Admin/AdminTickets"));
const AdminWaitlist = lazy(() => import("./App/Admin/AdminWaitlist"));
const AdminWaitlistMove = lazy(() => import("./App/Admin/AdminWaitlistmove"));
const ChartOfAccounts = lazy(() => import("./App/Finance/ChartOfAccounts"));
const JournalEntries = lazy(() => import("./App/Finance/JournalEntries"));
const Reports = lazy(() => import("./App/Finance/Reports"));
const CostCenters = lazy(() => import("./App/Finance/CostCenters"));
const TechnicalJobsAdmin = lazy(() => import("./App/Tecnico/TechnicalJobsAdmin"));
const TechnicalVisitsExecution = lazy(() => import("./App/Tecnico/TechnicalVisitExecution"));
const EngineerProjects = lazy(() => import("./App/Tecnico/EngineerProjects"));
const UserAccessManager = lazy(() => import("./App/Admin/UserAccessManager"));
const AdminGroups = lazy(() => import("./App/Admin/AdminGroups"));
const TechnicalHomologationsAdmin = lazy(() => import("./App/Tecnico/TechnicalHomologationsAdmin"));

/* ========= FRANCHISE PAGES ========= */
const FranchiseDashboard = lazy(() => import("./App/Franchise/FranchiseDashboard"));
const FranchiseFamilies = lazy(() => import("./App/Franchise/FranchiseFamilies"));
const FranchiseGroups = lazy(() => import("./App/Franchise/FranchiseGroups"));
const FranchiseFinance = lazy(() => import("./App/Franchise/FranchiseFinance"));
const FranchiseMarketing = lazy(() => import("./App/Franchise/FranchiseMarketing"));

/* ========= INVESTOR PAGES ========= */
const InvestorDashboard = lazy(() => import("./App/Investor/InvestorDashboard"));
const InvestorReports = lazy(() => import("./App/Investor/InvestorReports"));
const InvestorContracts = lazy(() => import("./App/Investor/InvestorContracts"));
const InvestorPortfolio = lazy(() => import("./App/Investor/InvestorPortfolio"));

function AppLoader() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        fontSize: "16px",
      }}
    >
      Carregando...
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AnalyticsListener />

      <Suspense fallback={<AppLoader />}>
        <Routes>
          {/* ========= PUBLIC ========= */}
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

          {/* ========= FAMILY ========= */}
          <Route
            path="/family"
            element={
              <PrivateArea allowedRoles={["family"]}>
                <FamilyLayout />
              </PrivateArea>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<FamilyDashboard />} />
            <Route path="contract" element={<FamilyContract />} />
            <Route path="contract/view/:contractId" element={<FamilyContractView />} />
            <Route path="education" element={<FamilyEducation />} />
            <Route path="payments" element={<FamilyPayments />} />
            <Route path="plan" element={<FamilyPlan />} />
            <Route path="profile" element={<Profile />} />
            <Route path="suporte" element={<FamilySupportCenter />} />
            <Route path="documents" element={<FamilyDocuments />} />
          </Route>

          {/* ========= ADMIN ========= */}
          <Route
            path="/admin"
            element={
              <PrivateArea allowedRoles={["admin"]}>
                <AdminLayout />
              </PrivateArea>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="families" element={<AdminFamilies />} />
            <Route path="franchises" element={<AdminFranchises />} />
            <Route path="investors" element={<AdminInvestors />} />
            <Route path="finance" element={<AdminFinance />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="franchise-approvals" element={<AdminFranchiseApprovals />} />
            <Route path="plans" element={<AdminPlans />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="contract" element={<AdminContract />} />
            <Route path="cad-videos" element={<AdminEducationVideos />} />
            <Route path="admintickets" element={<AdminTickets />} />
            <Route path="adminwaitlist" element={<AdminWaitlist />} />
            <Route path="financeiro/plano-de-contas" element={<ChartOfAccounts />} />
            <Route path="financeiro/lancamentos" element={<JournalEntries />} />
            <Route path="financeiro/relatorios" element={<Reports />} />
            <Route path="financeiro/centros-de-custo" element={<CostCenters />} />
            <Route path="thecnical/agend" element={<TechnicalJobsAdmin />} />
            <Route path="thecnical/technician" element={<TechnicalVisitsExecution />} />
            <Route path="thecnical/engineer" element={<EngineerProjects />} />
            <Route path="thecnical/homologacao" element={<TechnicalHomologationsAdmin />} />
            <Route path="access" element={<UserAccessManager />} />
            <Route path="groups" element={<AdminGroups />} />
            <Route path="adminwaitlistmove" element={<AdminWaitlistMove />} />
          </Route>

          {/* ========= FRANCHISE ========= */}
          <Route
            path="/franchise"
            element={
              <PrivateArea allowedRoles={["franchise"]}>
                <FranchiseLayout />
              </PrivateArea>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<FranchiseDashboard />} />
            <Route path="families" element={<FranchiseFamilies />} />
            <Route path="groups" element={<FranchiseGroups />} />
            <Route path="finance" element={<FranchiseFinance />} />
            <Route path="marketing" element={<FranchiseMarketing />} />
          </Route>

          {/* ========= INVESTOR ========= */}
          <Route
            path="/investor"
            element={
              <PrivateArea allowedRoles={["investor"]}>
                <InvestorLayout />
              </PrivateArea>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<InvestorDashboard />} />
            <Route path="reports" element={<InvestorReports />} />
            <Route path="contracts" element={<InvestorContracts />} />
            <Route path="portfolio" element={<InvestorPortfolio />} />
          </Route>

          {/* ========= FALLBACK ========= */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
