/*
Features:
1. Enter the lottery by paying some eth
2. Pick a random winner (verifiably random)
3. Winner to be selected every X minutes -> completely automated
4. Chainlink Oracles -> Randomness, Automated execution (Chainlink Keeper)

Steps:
1. Write code
2. Refactor code for gas optimization
*/

// SPDX-License-Identifier: MIT 
pragma solidity ^0.8.9;

// custom errors
error Raffle__InsufficientFund();

contract Raffle {
    // variables
    uint private immutable i_entranceFee;
    address payable [] private s_players;

    // constructor
    constructor(uint _entranceFee) {
        i_entranceFee = _entranceFee;
    }

    // setter functions
    function enterRaffle() public payable {
        if(msg.value < i_entranceFee) {
            revert Raffle__InsufficientFund();
        }

        s_players.push(payable(msg.sender));
    }

    // getter functions
    function getPlayer(uint _idx) public view returns (address) {
        return s_players[_idx];
    }
    // modifiers
}