import { Template } from 'meteor/templating';
import { Session } from 'meteor/session';
import { ReactiveVar } from 'meteor/reactive-var';
import { Router } from 'meteor/iron:router';
import { Meteor } from 'meteor/meteor';
import { TAPi18n } from 'meteor/tap:i18n';

import { Contracts } from '/imports/api/contracts/Contracts';
import { introEditor } from '/imports/ui/templates/widgets/compose/compose';
import { getCoin } from '/imports/api/blockchain/modules/web3Util.js';
import { geo } from '/lib/geo';

import '/imports/ui/templates/layout/url/home/home.html';
import '/imports/ui/templates/widgets/feed/feed.js';
import '/imports/ui/templates/widgets/tally/tally.js';
import '/imports/ui/templates/widgets/feed/paginator.js';
import '/imports/ui/templates/widgets/compose/compose.js';
import '/imports/ui/templates/components/decision/ledger/ledger.js';

Template.home.onCreated(function () {
  this.modeVar = new ReactiveVar();
  const instance = this;

  this.autorun(() => {
    Template.instance().modeVar.set(Router.current().url);
    const avatarList = Session.get('avatarList');
    if (avatarList) {
      const query = [];
      for (const i in avatarList) {
        query.push({ _id: avatarList[i] });
      }
      this.subscription = instance.subscribe('singleUser', { $or: query });
    }
  });
});

Template.home.onRendered(() => {
  Session.set('editorMode', false);
});

Template.home.helpers({
  editorMode() {
    return Session.get('showPostEditor');
  },
  newContractId() {
    if (Session.get('draftContract')) {
      return Session.get('draftContract')._id;
    }
    return undefined;
  },
  modeArray() {
    return [Template.instance().modeVar.get()];
  },
  content() {
    return {
      template: 'feed',
      dataObject: this,
    };
  },
  newLogin() {
    return Session.get('newLogin');
  },
});

Template.screen.helpers({
  tag() {
    return (this.options.view === 'tag');
  },
  peer() {
    return (this.options.view === 'peer');
  },
  home() {
    return (this.options.view === 'latest');
  },
  post() {
    return (this.options.view === 'post');
  },
  geo() {
    return (this.options.view === 'geo');
  },
  token() {
    return (this.options.view === 'token');
  },
});

Template.homeFeed.onCreated(function () {
  Template.instance().feedReady = new ReactiveVar(false);
  const instance = this;
  const subscription = instance.subscribe('feed', { view: instance.data.options.view, sort: { createdAt: -1 } });

  Session.set('minimizedEditor', true);

  if (!Session.get('draftContract') && !Meteor.Device.isPhone()) {
    introEditor({ desktopMode: true, replyMode: false, replyId: '' });
  }

  instance.autorun(function (computation) {
    if (subscription.ready()) {
      instance.feedReady.set(true);
      computation.stop();
    }
  });
});

Template.homeFeed.helpers({
  editorMode() {
    return Session.get('showPostEditor');
  },
  minimizedMode() {
    return Session.get('minimizedEditor');
  },
  replyMode() {
    return (Session.get('draftContract') && Session.get('draftContract').replyId);
  },
  newContractId() {
    if (Session.get('draftContract')) {
      return Session.get('draftContract')._id;
    }
    return undefined;
  },
  mainFeed() {
    const tally = this;
    Session.set('longFeedView', this.options.view);
    return tally;
  },
  mainLedger() {
    const tally = this;
    console.log("Main Ledger:");
    console.log(tally);
    tally.options.sort = { timestamp: -1 };

    return {
      options: tally.options,
      singlePost: true,
      hidePost: false,
      peerFeed: false,
      postFeed: false,
      homeFeed: true,
    };
  },
  feedReady() {
    return Template.instance().feedReady.get();
  },
  feedTitle() {
    let asset;
    switch (this.options.view) {
      case 'token':
        asset = getCoin(this.options.token);
        return TAPi18n.__('feed-token-posts').replace('{{asset}}', asset.name);
      case 'geo':
        asset = _.where(geo.country, { code: this.options.country.toUpperCase() })[0];
        return TAPi18n.__('feed-geo-posts').replace('{{asset}}', asset.name);
      default:
        return TAPi18n.__('happening-now');
    }
  },
});

Template.postFeed.onCreated(function () {
  Template.instance().postReady = new ReactiveVar(false);

  const instance = this;
  const subscription = instance.subscribe('singleContract', { view: 'thread', sort: { createdAt: -1 }, keyword: Template.currentData().options.keyword });

  instance.autorun(function (computation) {
    if (subscription.ready()) {
      instance.postReady.set(true);
      computation.stop();
    }
  });
});

Template.postFeed.helpers({
  votes() {
    const tally = this;
    tally.options.view = 'threadVotes';
    tally.options.sort = { timestamp: -1 };
    tally.ballotEnabled = this.ballotEnabled;
    tally.postReady = this.postReady;
    tally.peerFeed = false;
    tally.postFeed = true;
    // options=this.options ballotEnabled=ballotEnabled postReady=postReady peerFeed=false postFeed=true
    // winning options
    const contract = Contracts.findOne({ keyword: Template.currentData().options.keyword });
    let maxVotes = 0;
    let winningBallot;
    if (contract && contract.tally) {
      for (const i in contract.tally.choice) {
        if (contract.tally.choice[i].votes > maxVotes) {
          maxVotes = contract.tally.choice[i].votes;
          winningBallot = contract.tally.choice[i].ballot;
        }
      }
      tally.winningBallot = winningBallot;
      tally.contractId = tally._id;
    }

    return tally;
  },
  postReady() {
    return Template.instance().postReady.get();
  },
  thread() {
    const replies = this;
    replies.options.view = 'thread';
    replies.singlePost = true;
    replies.displayActions = true;
    return replies;
  },
  ballotEnabled() {
    const contract = Contracts.findOne({ keyword: Template.currentData().options.keyword });
    if (contract) {
      return contract.ballotEnabled;
    }
    return undefined;
  },
  newContractId() {
    if (Session.get('draftContract')) {
      return Session.get('draftContract')._id;
    }
    return undefined;
  },
  editorMode() {
    return Session.get('showPostEditor');
  },
  replyId() {
    const contract = Contracts.findOne({ keyword: this.options.keyword });
    if (contract) {
      return contract._id;
    }
    return undefined;
  },
});
