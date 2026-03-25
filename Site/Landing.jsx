import React from "react";
import { landingBenefits, landingFaqItems, landingSteps } from "./Landing/content";
import { useLandingTracking } from "./Landing/tracking";
import Navbar from "./Landing/components/Navbar";
import HeroSection from "./Landing/components/HeroSection";
import QueueOverviewSection from "./Landing/components/QueueOverviewSection";
import HowItWorksSection from "./Landing/components/HowItWorksSection";
import BenefitsSection from "./Landing/components/BenefitsSection";
import UserTypesSection from "./Landing/components/UserTypesSection";
import FaqSection from "./Landing/components/FaqSection";
import TrustBlockSection from "./Landing/components/TrustBlockSection";
import FinalCtaSection from "./Landing/components/FinalCtaSection";
import FooterSection from "./Landing/components/FooterSection";

export default function Landing() {
  const ano = new Date().getFullYear();
  const tracking = useLandingTracking();

  return (
    <div className="min-h-screen bg-white">
      <Navbar tracking={tracking} />
      <HeroSection tracking={tracking} />
      <QueueOverviewSection tracking={tracking} />
      <HowItWorksSection steps={landingSteps} tracking={tracking} />
      <BenefitsSection benefits={landingBenefits} />
      <UserTypesSection tracking={tracking} />
      <FaqSection faqItems={landingFaqItems} tracking={tracking} />
      <TrustBlockSection tracking={tracking} />
      <FinalCtaSection tracking={tracking} />
      <FooterSection ano={ano} tracking={tracking} />
    </div>
  );
}
