<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  import { browser } from '$app/environment';
  import { env as pubEnvironment } from '$env/dynamic/public';

  import type { CreatorDocument } from '$lib/models/creator';
  import type { ShowDocument } from '$lib/models/show';
  import type { UserDocumentType } from '$lib/models/user';

  import { jitsiInterfaceConfigOverwrite } from '$lib/constants';

  export let creator: CreatorDocument;
  export let currentShow: ShowDocument;
  export let jitsiToken: string;
  export let leftShowCallback: () => void;
  export let user: UserDocumentType;

  let videoCallElement: HTMLDivElement;
  let api: any;
  let participantName = '';
  let hasLeftShow = false;

  const participantJoined = (event: any) => {
    console.log('participantJoined', event);
    const numberOfParticipants = api.getNumberOfParticipants();
    console.log('numberOfParticipants', numberOfParticipants);
    api.getRoomsInfo().then((rooms: any) => {
      console.log('rooms', rooms);
    });
  };

  const participantKnocked = (participant: any) => {
    participantName = participant?.displayName;
    console.log('participantName', participantName);
  };

  const postLeaveShow = async () => {
    if (hasLeftShow || !browser) return;
    hasLeftShow = true;
    api?.executeCommand('endConference');
    api?.executeCommand('hangup');

    let formData = new FormData();
    await fetch('?/leave_show', {
      method: 'POST',
      body: formData
    });

    api?.dispose();
    videoCallElement?.remove();
    leftShowCallback?.();
  };

  onDestroy(() => {
    postLeaveShow();
  });

  onMount(() => {
    const options = {
      roomName: currentShow?.name,
      jwt: jitsiToken,
      width: '100%',
      height: '100%',
      parentNode: videoCallElement,
      userInfo: {
        displayName: user.name
      },
      interfaceConfigOverwrite: jitsiInterfaceConfigOverwrite,
      configOverwrite: {
        localSubject: currentShow?.name,
        filmstrip: {
          enabled: false
        },
        disabledNotifications: ['dialog.sessTerminated']
      }
    };

    // @ts-ignore
    api = new JitsiMeetExternalAPI(pubEnvironment.PUBLIC_JITSI_DOMAIN, options);
    api.executeCommand('avatarUrl', creator.user.profileImageUrl);
    api.executeCommand('subject', currentShow?.name);
    api.addListener('participantJoined', participantJoined);
    api.addListener('knockingParticipant', participantKnocked);
    api.addListener('toolbarButtonClicked', async (event: any) => {
      if (event?.key === 'leave-show') {
        await postLeaveShow();
      }
    });

    api.addListener('videoConferenceLeft', () => {
      postLeaveShow();
    });
  });
</script>

<div class="fixed top-0 z-20 h-screen w-screen">
  <div bind:this={videoCallElement} class="h-screen" />
</div>
