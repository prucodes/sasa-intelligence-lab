import {LabApp} from './lab-app';
import {WelcomeScreen} from './welcome';
import {WELCOME_ENTRY_SCRIPT} from '@/lib/welcome-entry';

export default function OverviewPage() {
  return <>
    <script dangerouslySetInnerHTML={{__html: WELCOME_ENTRY_SCRIPT}} />
    <WelcomeScreen/>
    <LabApp page="overview"/>
  </>;
}
