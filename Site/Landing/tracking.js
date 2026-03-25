import { trackEvent } from "../../api/firebaseAnalytics";

export function useLandingTracking() {
  const trackCTA = (ctaName, ctaLocation, extra = {}) => {
    trackEvent("cta_click", {
      page_name: "landing",
      cta_name: ctaName,
      cta_location: ctaLocation,
      ...extra,
    });
  };

  const trackLead = (leadType, ctaLocation, extra = {}) => {
    trackEvent("generate_lead", {
      page_name: "landing",
      lead_type: leadType,
      cta_location: ctaLocation,
      ...extra,
    });
  };

  const handleWaitlistClick = (location) => {
    trackCTA("entrar_pre_fila", location);
    trackLead("waitlist", location);
  };

  const handleSimulatorClick = (location) => {
    trackCTA("simular_economia", location);
    trackEvent("simulator_start", {
      page_name: "landing",
      cta_location: location,
    });
  };

  const handleLoginClick = (location) => {
    trackCTA("entrar_login", location);
  };

  const handleFamilyRegisterClick = (location) => {
    trackCTA("family_register", location);
    trackLead("family_register", location);
  };

  const handleInvestorRegisterClick = (location) => {
    trackCTA("investor_register", location);
    trackLead("investor_register", location);
  };

  const handleSectionClick = (sectionName, location) => {
    trackCTA(`ver_${sectionName}`, location, { target_section: sectionName });
  };

  const handlePrivacyClick = (location) => {
    trackCTA("politica_privacidade", location);
  };

  const handleTermsClick = (location) => {
    trackCTA("termos", location);
  };

  const handleContactClick = (contactType, location) => {
    trackEvent("contact_click", {
      page_name: "landing",
      contact_type: contactType,
      cta_location: location,
    });
  };

  return {
    trackCTA,
    handleWaitlistClick,
    handleSimulatorClick,
    handleLoginClick,
    handleFamilyRegisterClick,
    handleInvestorRegisterClick,
    handleSectionClick,
    handlePrivacyClick,
    handleTermsClick,
    handleContactClick,
  };
}
