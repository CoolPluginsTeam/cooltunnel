!macro customInstall
  Delete "$DESKTOP\Local to Cloud.lnk"
  Delete "$SMPROGRAMS\Local to Cloud.lnk"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend

!macro customUnInstall
  Delete "$DESKTOP\Local to Cloud.lnk"
  Delete "$SMPROGRAMS\Local to Cloud.lnk"
  Delete "$DESKTOP\CoolTunnel.lnk"
  Delete "$SMPROGRAMS\CoolTunnel.lnk"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
!macroend
